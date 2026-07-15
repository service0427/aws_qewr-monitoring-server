let currentServers = [];
let currentServerId = null;
let currentFilter = 'all';
let prevServersMap = new Map();

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split(/[-T :]/);
    if (parts.length >= 6) {
        return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    }
    return new Date(dateStr);
}

function getTimeAgo(lastPing) {
    const pingDate = parseLocalDate(lastPing);
    const diff = Math.floor((new Date() - pingDate) / 1000);
    
    if (diff < 0) return "now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function filterServers(filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.stats-card').forEach(card => {
        card.classList.remove('active-filter');
    });
    const activeCard = document.querySelector(`.stats-card.${filterType}`);
    if (activeCard) {
        activeCard.classList.add('active-filter');
    }
    renderDashboardList();
}

async function updateDashboard() {
    try {
        const response = await fetch('/api/servers', { cache: 'no-store' });
        const servers = await response.json();
        
        servers.sort((a, b) => a.name.localeCompare(b.name));

        let totalServers = servers.length;
        let onlineServers = 0;
        let alertServers = 0;
        let offlineServers = 0;

        let totalExpectedADB = 0;
        let totalCurrentADB = 0;
        let totalAdbDevice = 0;
        let totalAdbUnauthorized = 0;
        let totalAdbOffline = 0;

        servers.forEach(s => {
            totalExpectedADB += s.expected_devices || 0;
            totalCurrentADB += s.current_devices || 0;

            let sSpecs = {};
            try {
                sSpecs = JSON.parse(s.specs || '{}');
            } catch (e) {}
            const states = sSpecs.adb_device_states || {};
            if (states.device !== undefined) {
                totalAdbDevice += states.device || 0;
                totalAdbUnauthorized += states.unauthorized || 0;
                totalAdbOffline += states.offline || 0;
            } else {
                totalAdbDevice += s.current_devices || 0;
            }
            
            const pingDate = parseLocalDate(s.last_ping);
            const diff = Math.floor((new Date() - pingDate) / 1000);
            
            const isOffline = diff > 300; // 5 minutes
            const hasAdbIssues = (states.unauthorized || 0) > 0 || (states.offline || 0) > 0;
            const isAdbAlert = (s.expected_devices > 0 && s.current_devices !== s.expected_devices) || hasAdbIssues;
            const isAlert = s.status === 'warning' || 
                            (s.cpu_alert_enabled && s.cpu_usage > s.cpu_threshold) || 
                            (s.mem_alert_enabled && s.mem_usage > s.mem_threshold) || 
                            (s.disk_alert_enabled && s.disk_usage > s.disk_threshold) ||
                            isAdbAlert;
            
            if (isOffline) {
                offlineServers++;
            } else if (isAlert) {
                alertServers++;
            } else {
                onlineServers++;
            }
        });

        // Update DOM elements for statistics
        const elTotal = document.getElementById('stats-total-val');
        const elOnline = document.getElementById('stats-online-val');
        const elAlert = document.getElementById('stats-alert-val');
        const elOffline = document.getElementById('stats-offline-val');
        const elAdb = document.getElementById('stats-adb-val');
        
        if (elTotal) elTotal.innerText = totalServers;
        if (elOnline) elOnline.innerText = onlineServers;
        if (elAlert) elAlert.innerText = alertServers;
        if (elOffline) elOffline.innerText = offlineServers;
        
        if (elAdb) {
            let adbText = `${totalCurrentADB} / ${totalExpectedADB}`;
            if (totalAdbUnauthorized > 0 || totalAdbOffline > 0) {
                adbText += ` (⚠️ ${totalAdbUnauthorized + totalAdbOffline})`;
            }
            elAdb.innerText = adbText;

            const adbLabel = document.querySelector('.stats-card.adb .stats-label');
            if (adbLabel) {
                if (totalAdbUnauthorized > 0 || totalAdbOffline > 0) {
                    adbLabel.innerHTML = `ADB 기기 연결 <span style="color:var(--warning); font-size: 0.55rem;">[미인증:${totalAdbUnauthorized} 오프:${totalAdbOffline}]</span>`;
                } else {
                    adbLabel.innerText = "ADB 기기 연결";
                }
            }

            const adbCard = document.querySelector('.stats-card.adb');
            if (adbCard) {
                const isMismatch = (totalExpectedADB > 0 && totalCurrentADB !== totalExpectedADB) || totalAdbUnauthorized > 0 || totalAdbOffline > 0;
                if (isMismatch) {
                    adbCard.classList.add('mismatch');
                } else {
                    adbCard.classList.remove('mismatch');
                }
            }
        }

        // Keep correct active class based on currentFilter
        document.querySelectorAll('.stats-card').forEach(card => {
            card.classList.remove('active-filter');
        });
        const activeCard = document.querySelector(`.stats-card.${currentFilter}`);
        if (activeCard) {
            activeCard.classList.add('active-filter');
        }

        // Store old servers for change comparison
        prevServersMap = new Map(currentServers.map(s => [s.id, s]));
        currentServers = servers;

        renderDashboardList();

    } catch (error) {
        console.error('Update failed:', error);
    }
}

function renderDashboardList() {
    const container = document.getElementById('server-list');
    if (!container) return;

    if (currentServers.length === 0) {
        container.innerHTML = '<div class="loading">등록된 서버가 없습니다.</div>';
        return;
    }

    const filteredServers = currentServers.filter(server => {
        const pingDate = parseLocalDate(server.last_ping);
        const diff = Math.floor((new Date() - pingDate) / 1000);
        const isOffline = diff > 300;
        
        let specs = {};
        try {
            specs = JSON.parse(server.specs || '{}');
        } catch (e) {}
        const states = specs.adb_device_states || {};
        const hasAdbIssues = (states.unauthorized || 0) > 0 || (states.offline || 0) > 0;
        const isAdbAlert = (server.expected_devices > 0 && server.current_devices !== server.expected_devices) || hasAdbIssues;
        const isAlert = server.status === 'warning' || 
                        (server.cpu_alert_enabled && server.cpu_usage > server.cpu_threshold) || 
                        (server.mem_alert_enabled && server.mem_usage > server.mem_threshold) || 
                        (server.disk_alert_enabled && server.disk_usage > server.disk_threshold) ||
                        isAdbAlert;

        if (currentFilter === 'online') {
            return !isOffline && !isAlert;
        } else if (currentFilter === 'warning') {
            return !isOffline && isAlert;
        } else if (currentFilter === 'offline') {
            return isOffline;
        }
        return true;
    });

    if (filteredServers.length === 0) {
        container.innerHTML = `<div class="loading">조건에 맞는 서버가 없습니다.</div>`;
        return;
    }

    container.innerHTML = filteredServers.map(server => {
        const oldServer = prevServersMap.get(server.id);
        const isCpuUpdated = oldServer && oldServer.cpu_usage.toFixed(0) !== server.cpu_usage.toFixed(0);
        const isMemUpdated = oldServer && oldServer.mem_usage.toFixed(0) !== server.mem_usage.toFixed(0);

        const isCpuAlert = server.cpu_alert_enabled && server.cpu_usage > server.cpu_threshold;
        const isMemAlert = server.mem_alert_enabled && server.mem_usage > server.mem_threshold;
        const isDiskAlert = server.disk_alert_enabled && server.disk_usage > server.disk_threshold;

        const pingDate = parseLocalDate(server.last_ping);
        const diff = Math.floor((new Date() - pingDate) / 1000);
        const isOffline = diff > 300;
        const cardStatus = isOffline ? 'critical' : server.status;

        let specs = {};
        try {
            specs = JSON.parse(server.specs || '{}');
        } catch (e) {}
        const gitVersionInfo = specs["nmap_multi_v1 version"] || "";

        const states = specs.adb_device_states;
        const hasAdbIssues = states && ((states.unauthorized || 0) > 0 || (states.offline || 0) > 0);
        const adbMismatch = (server.expected_devices > 0 && server.current_devices !== server.expected_devices) || hasAdbIssues;

        let adbBadge = '';
        if (states) {
            const devCount = states.device || 0;
            const unauthCount = states.unauthorized || 0;
            const offlineCount = states.offline || 0;
            const otherCount = states.other || 0;
            
            adbBadge = `
                <span class="adb-badge ${adbMismatch ? 'mismatch' : 'match'}">
                    <i class="fas fa-mobile-alt"></i> ${server.current_devices}/${server.expected_devices || server.current_devices}
                </span>
                <span class="adb-state-badge device" title="정상"><i class="fas fa-check"></i> ${devCount}</span>
                ${unauthCount > 0 ? `<span class="adb-state-badge unauthorized" title="미인증"><i class="fas fa-exclamation"></i> ${unauthCount}</span>` : ''}
                ${offlineCount > 0 ? `<span class="adb-state-badge offline" title="오프라인"><i class="fas fa-times"></i> ${offlineCount}</span>` : ''}
                ${otherCount > 0 ? `<span class="adb-state-badge other" title="기타"><i class="fas fa-question"></i> ${otherCount}</span>` : ''}
            `;
        } else {
            adbBadge = server.expected_devices > 0 
                ? `<span class="adb-badge ${adbMismatch ? 'mismatch' : 'match'}"><i class="fas fa-mobile-alt"></i> ${server.current_devices}/${server.expected_devices}</span>`
                : (server.current_devices > 0 ? `<span class="adb-badge match"><i class="fas fa-mobile-alt"></i> ${server.current_devices}</span>` : '');
        }

        // Calculate Remote Control URL
        let remoteUrl = "";
        if (server.remote_access_type && server.remote_access_type > 0) {
            let finalRemoteIp = server.ip_address;
            if (server.remote_access_type == 2) { // Tailscale
                const allIpsStr = specs["All IPs"] || "";
                const tsMatch = allIpsStr.match(/100\.\d+\.\d+\.\d+/);
                if (tsMatch) {
                    finalRemoteIp = tsMatch[0];
                }
            }
            remoteUrl = `http://${finalRemoteIp}:5000`;
        }

        return `
            <div class="server-card ${cardStatus} ${adbMismatch || isOffline ? 'adb-warning' : ''}" onclick="showDetails(${server.id})">
                <div class="server-name">
                    <span>
                        ${server.name}
                        ${server.location ? `<span class="location-small">[${server.location}]</span>` : ''}
                    </span>
                    <div class="name-right">
                        ${remoteUrl ? `
                            <a href="${remoteUrl}" target="_blank" onclick="event.stopPropagation();" ontouchstart="event.stopPropagation();" class="card-remote-btn" title="Open Remote Control (scrcpy)">
                                <i class="fas fa-desktop"></i>
                            </a>
                        ` : ''}
                        <span class="time-ago">${isOffline ? 'OFFLINE' : getTimeAgo(server.last_ping)}</span>
                    </div>
                </div>
                ${server.memo ? `
                    <div class="server-memo" title="${server.memo}">
                        <i class="far fa-sticky-note"></i> ${server.memo}
                    </div>
                ` : ''}
                
                <div class="card-meta">
                    ${adbBadge ? `<span class="meta-item">${adbBadge}</span>` : ''}
                    ${gitVersionInfo ? `<span class="meta-item git-ver"><i class="fab fa-github"></i> ${gitVersionInfo}</span>` : ''}
                </div>
                <div class="metrics">
                    <div class="metric-item ${isCpuAlert ? 'alert-active' : ''}">
                        <span class="label">CPU</span>
                        <span class="value ${isCpuAlert ? 'high' : ''} ${isCpuUpdated ? 'updated' : ''}">${server.cpu_usage.toFixed(0)}%</span>
                    </div>
                    <div class="metric-item ${isMemAlert ? 'alert-active' : ''}">
                        <span class="label">MEM</span>
                        <span class="value ${isMemAlert ? 'high' : ''} ${isMemUpdated ? 'updated' : ''}">${server.mem_usage.toFixed(0)}%</span>
                    </div>
                    <div class="metric-item ${isDiskAlert ? 'alert-active' : ''}">
                        <span class="label">DSK</span>
                        <span class="value ${isDiskAlert ? 'high' : ''}">${server.disk_usage.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function copyInstallerCommand() {
    const cmd = document.getElementById('installer-cmd').innerText;
    navigator.clipboard.writeText(cmd).then(() => {
        const box = document.querySelector('.installer-copy-box');
        const originalHtml = box.innerHTML;
        box.innerHTML = '<i class="fas fa-check"></i> <span>Copied!</span>';
        box.style.borderColor = 'var(--success)';
        setTimeout(() => {
            box.innerHTML = originalHtml;
            box.style.borderColor = '#333';
        }, 2000);
    });
}

function showDetails(serverId) {
    const server = currentServers.find(s => s.id === serverId);
    if (!server) return;

    currentServerId = serverId;

    let specs = {};
    try {
        specs = JSON.parse(server.specs || '{}');
    } catch (e) {
        specs = { "Info": server.specs };
    }

    document.getElementById('modal-server-name').innerText = server.name;
    document.getElementById('modal-location-input').value = server.location || '';
    document.getElementById('modal-memo-input').value = server.memo || '';
    
    document.getElementById('cpu-threshold').value = server.cpu_threshold || 90;
    document.getElementById('mem-threshold').value = server.mem_threshold || 90;
    document.getElementById('disk-threshold').value = server.disk_threshold || 90;
    document.getElementById('cpu-alert-toggle').checked = !!server.cpu_alert_enabled;
    document.getElementById('mem-alert-toggle').checked = !!server.mem_alert_enabled;
    document.getElementById('disk-alert-toggle').checked = !!server.disk_alert_enabled;
    document.getElementById('remote-access-type').value = server.remote_access_type || 0;
    document.getElementById('expected-devices').value = server.expected_devices || 0;

    const remoteSection = document.getElementById('remote-access-section');
    const remoteBtn = document.getElementById('modal-remote-btn');
    
    if (server.remote_access_type && server.remote_access_type > 0) {
        remoteSection.style.display = 'block';
        let finalRemoteIp = server.ip_address;
        
        if (server.remote_access_type == 2) { // Tailscale
            const allIpsStr = specs["All IPs"] || "";
            const tsMatch = allIpsStr.match(/100\.\d+\.\d+\.\d+/);
            if (tsMatch) {
                finalRemoteIp = tsMatch[0];
            }
        }
        remoteBtn.href = `http://${finalRemoteIp}:5000`;
    } else {
        remoteSection.style.display = 'none';
    }

    const pingDate = parseLocalDate(server.last_ping);
    const diff = Math.floor((new Date() - pingDate) / 1000);
    const isOffline = diff > 300;

    const specList = document.getElementById('modal-spec-list');
    const basicInfo = {
        "IP Address": server.ip_address,
        "Location": server.location || 'Not Set',
        "Status": isOffline ? 'offline/disconnected' : server.status,
        "Uptime": server.uptime,
        "Last Ping": pingDate.toLocaleString(),
        "Hardware ID": server.hardware_id,
        "ADB Devices (Current/Expected)": server.expected_devices > 0 
            ? `${server.current_devices} / ${server.expected_devices}` 
            : `${server.current_devices} (Expected: Not Set)`
    };

    if (specs.adb_device_states) {
        const states = specs.adb_device_states;
        basicInfo["ADB Device Breakdown"] = `
            <span class="adb-state-badge device" style="font-size:0.75rem; padding: 2px 6px; margin-right: 4px;"><i class="fas fa-check"></i> 정상: ${states.device || 0}</span>
            <span class="adb-state-badge unauthorized" style="font-size:0.75rem; padding: 2px 6px; margin-right: 4px;"><i class="fas fa-exclamation-triangle"></i> 미인증: ${states.unauthorized || 0}</span>
            <span class="adb-state-badge offline" style="font-size:0.75rem; padding: 2px 6px; margin-right: 4px;"><i class="fas fa-times-circle"></i> 오프라인: ${states.offline || 0}</span>
            ${states.other ? `<span class="adb-state-badge other" style="font-size:0.75rem; padding: 2px 6px;"><i class="fas fa-question-circle"></i> 기타: ${states.other}</span>` : ''}
        `;
    }

    const specsDisplay = { ...specs };
    delete specsDisplay.adb_device_states;
    delete specsDisplay.adb_recovery_summary;

    const allInfo = { ...basicInfo, ...specsDisplay };

    specList.innerHTML = Object.entries(allInfo).map(([key, value]) => `
        <div class="spec-item">
            <span class="spec-label">${key}:</span>
            <span class="spec-value">${value}</span>
        </div>
    `).join('');

    const recoverySection = document.getElementById('modal-recovery-section');
    const recoveryLog = document.getElementById('modal-recovery-log');
    
    if (specs.adb_recovery_summary) {
        if (recoverySection && recoveryLog) {
            recoverySection.style.display = 'block';
            recoveryLog.innerText = specs.adb_recovery_summary;
        }
    } else {
        if (recoverySection) {
            recoverySection.style.display = 'none';
        }
    }

    document.getElementById('detail-modal').style.display = 'block';
    document.body.classList.add('modal-open');
}

async function saveMemoAndLocation() {
    if (!currentServerId) return;
    const memoValue = document.getElementById('modal-memo-input').value;
    const locationValue = document.getElementById('modal-location-input').value;

    try {
        const response = await fetch(`/api/servers/${currentServerId}/memo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memo: memoValue, location: locationValue })
        });
        if (response.ok) {
            alert('Location & Memo saved successfully!');
            updateDashboard();
        } else {
            alert('Failed to save location/memo.');
        }
    } catch (error) {
        console.error('Save failed:', error);
        alert('An error occurred while saving.');
    }
}

async function saveAlertSettings() {
    if (!currentServerId) return;
    const settings = {
        cpu_threshold: parseFloat(document.getElementById('cpu-threshold').value),
        mem_threshold: parseFloat(document.getElementById('mem-threshold').value),
        disk_threshold: parseFloat(document.getElementById('disk-threshold').value),
        cpu_alert_enabled: document.getElementById('cpu-alert-toggle').checked,
        mem_alert_enabled: document.getElementById('mem-alert-toggle').checked,
        disk_alert_enabled: document.getElementById('disk-alert-toggle').checked,
        remote_access_type: parseInt(document.getElementById('remote-access-type').value),
        expected_devices: parseInt(document.getElementById('expected-devices').value) || 0
    };

    try {
        const response = await fetch(`/api/servers/${currentServerId}/alert_settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (response.ok) {
            alert('Alert settings saved successfully!');
            updateDashboard();
        } else {
            alert('Failed to save settings.');
        }
    } catch (error) {
        console.error('Save failed:', error);
        alert('An error occurred while saving.');
    }
}

async function confirmDelete() {
    if (!currentServerId) return;
    const confirmation = prompt('서버를 삭제하시겠습니까? 삭제하려면 "확인"이라고 입력해주세요.');
    if (confirmation === '확인') {
        await deleteServer();
    } else if (confirmation !== null) {
        alert('문구가 일치하지 않아 삭제를 취소합니다.');
    }
}

async function deleteServer() {
    try {
        const response = await fetch(`/api/servers/${currentServerId}`, { method: 'DELETE' });
        if (response.ok) {
            alert('서버가 성공적으로 삭제되었습니다.');
            closeModal();
            updateDashboard();
        } else {
            alert('서버 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
    document.getElementById('metrics-history-list').style.display = 'none';
    const btn = document.querySelector('.view-metrics-btn');
    if (btn) btn.innerText = 'View Historical Metrics (Last 7 Days)';
    document.body.classList.remove('modal-open');
    currentServerId = null;
}

async function toggleMetrics() {
    const list = document.getElementById('metrics-history-list');
    const btn = document.querySelector('.view-metrics-btn');
    if (list.style.display === 'none') {
        list.style.display = 'block';
        btn.innerText = 'Close Historical Metrics';
        await loadHistoricalMetrics();
    } else {
        list.style.display = 'none';
        btn.innerText = 'View Historical Metrics (Last 7 Days)';
    }
}

async function loadHistoricalMetrics() {
    if (!currentServerId) return;
    const container = document.getElementById('metrics-data');
    container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading metrics...</td></tr>';
    
    try {
        const response = await fetch(`/api/servers/${currentServerId}/metrics`);
        const metrics = await response.json();
        
        if (!metrics || metrics.length === 0) {
            container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No logs found for the last 7 days.</td></tr>';
            return;
        }

        container.innerHTML = metrics.map(m => {
            const dt = new Date(m.timestamp);
            const timeStr = dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dateStr = dt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
            return `
                <tr>
                    <td>${dateStr} ${timeStr}</td>
                    <td style="color:${m.cpu_usage > 80 ? 'var(--danger)' : 'var(--success)'}">${m.cpu_usage.toFixed(1)}%</td>
                    <td style="color:${m.mem_usage > 80 ? 'var(--danger)' : 'var(--success)'}">${m.mem_usage.toFixed(1)}%</td>
                    <td>${m.disk_usage.toFixed(0)}%</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load metrics:', error);
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--danger); padding:20px;">Error loading logs.</td></tr>';
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('detail-modal');
    if (event.target == modal) {
        closeModal();
    }
}

setInterval(updateDashboard, 10000);
updateDashboard();
