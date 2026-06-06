let currentServers = [];
let currentServerId = null;

function getTimeAgo(lastPing) {
    const pingDate = lastPing.endsWith('Z') ? new Date(lastPing) : new Date(lastPing + 'Z');
    const diff = Math.floor((new Date() - pingDate) / 1000);
    
    if (diff < 0) return "now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
    const dateStr = now.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
    const clockEl = document.getElementById('current-time');
    if (clockEl) clockEl.innerText = `${dateStr} ${timeStr}`;
}

async function updateDashboard() {
    try {
        const response = await fetch('/api/servers', { cache: 'no-store' });
        const servers = await response.json();
        
        // 갱신 시간 표시
        const now = new Date();
        const refreshEl = document.getElementById('refresh-time');
        if (refreshEl) refreshEl.innerText = `Refreshed: ${now.toLocaleTimeString('ko-KR', { hour12: false })}`;
        
        const container = document.getElementById('server-list');
        const alertBadge = document.getElementById('alert-count');
        
        servers.sort((a, b) => a.name.localeCompare(b.name));

        const alertServers = servers.filter(s => s.status !== 'online').length;
        if (alertServers > 0) {
            alertBadge.innerText = `${alertServers} ALERT(S)`;
            alertBadge.className = 'badge critical';
        } else {
            alertBadge.innerText = 'ALL SYSTEMS NOMINAL';
            alertBadge.className = 'badge';
        }

        if (servers.length === 0) {
            container.innerHTML = '<div class="loading">등록된 서버가 없습니다.</div>';
            return;
        }

        const oldServersMap = new Map(currentServers.map(s => [s.id, s]));
        currentServers = servers;

        container.innerHTML = servers.map(server => {
            const oldServer = oldServersMap.get(server.id);
            const isCpuUpdated = oldServer && oldServer.cpu_usage.toFixed(0) !== server.cpu_usage.toFixed(0);
            const isMemUpdated = oldServer && oldServer.mem_usage.toFixed(0) !== server.mem_usage.toFixed(0);

            const isCpuAlert = server.cpu_alert_enabled && server.cpu_usage > server.cpu_threshold;
            const isMemAlert = server.mem_alert_enabled && server.mem_usage > server.mem_threshold;
            const isDiskAlert = server.disk_alert_enabled && server.disk_usage > server.disk_threshold;

            return `
                <div class="server-card ${server.status}" onclick="showDetails(${server.id})">
                    <div class="server-name">
                        <span>
                            ${server.name}
                            ${server.memo ? `<span class="memo-small"> - ${server.memo}</span>` : ''}
                        </span>
                        <div class="name-right">
                            <span class="time-ago">${getTimeAgo(server.last_ping)}</span>
                        </div>
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

    } catch (error) {
        console.error('Update failed:', error);
    }
}

function copyInstallerCommand() {
    const cmd = document.getElementById('installer-cmd').innerText;
    navigator.clipboard.writeText(cmd).then(() => {
        const box = document.querySelector('.installer-copy-box');
        const originalHtml = box.innerHTML;
        box.innerHTML = '<i class="fas fa-check"></i> <span>Copied to clipboard!</span>';
        box.style.borderColor = 'var(--success)';
        setTimeout(() => {
            box.innerHTML = originalHtml;
            box.style.borderColor = '#333';
        }, 2000);
    });
}

function openRemote(event) {
    event.stopPropagation();
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
    document.getElementById('modal-memo-input').value = server.memo || '';
    
    document.getElementById('cpu-threshold').value = server.cpu_threshold || 90;
    document.getElementById('mem-threshold').value = server.mem_threshold || 90;
    document.getElementById('disk-threshold').value = server.disk_threshold || 90;
    document.getElementById('cpu-alert-toggle').checked = !!server.cpu_alert_enabled;
    document.getElementById('mem-alert-toggle').checked = !!server.mem_alert_enabled;
    document.getElementById('disk-alert-toggle').checked = !!server.disk_alert_enabled;
    document.getElementById('remote-access-type').value = server.remote_access_type || 0;

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

    const specList = document.getElementById('modal-spec-list');
    const basicInfo = {
        "IP Address": server.ip_address,
        "Status": server.status,
        "Uptime": server.uptime,
        "Last Ping": new Date(server.last_ping).toLocaleString(),
        "Hardware ID": server.hardware_id
    };
    const allInfo = { ...basicInfo, ...specs };

    specList.innerHTML = Object.entries(allInfo).map(([key, value]) => `
        <div class="spec-item">
            <span class="spec-label">${key}:</span>
            <span class="spec-value">${value}</span>
        </div>
    `).join('');

    document.getElementById('detail-modal').style.display = 'block'; // flex 대신 block (z-index/scroll 이슈 방지)
    document.body.classList.add('modal-open');
}

async function saveMemo() {
    if (!currentServerId) return;
    const memoValue = document.getElementById('modal-memo-input').value;

    try {
        const response = await fetch(`/api/servers/${currentServerId}/memo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memo: memoValue })
        });
        if (response.ok) {
            alert('Memo saved successfully!');
            updateDashboard();
        } else {
            alert('Failed to save memo.');
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
        remote_access_type: parseInt(document.getElementById('remote-access-type').value)
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

setInterval(updateClock, 1000);
updateClock();

setInterval(updateDashboard, 10000);
updateDashboard();
