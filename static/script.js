let currentServers = [];
let currentServerId = null;

function getTimeAgo(lastPing) {
    const pingDate = lastPing.endsWith('Z') ? new Date(lastPing) : new Date(lastPing + 'Z');
    const diff = Math.floor((new Date() - pingDate) / 1000);
    
    if (diff < 0) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

async function updateDashboard() {
    try {
        const response = await fetch('/api/servers', { cache: 'no-store' });
        const servers = await response.json();
        currentServers = servers;
        
        const container = document.getElementById('server-list');
        const alertBadge = document.getElementById('alert-count');
        
        servers.sort((a, b) => {
            const score = { 'critical': 0, 'warning': 1, 'online': 2 };
            return (score[a.status] || 2) - (score[b.status] || 2);
        });

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

        container.innerHTML = servers.map(server => `
            <div class="server-card ${server.status}" onclick="showDetails(${server.id})">
                <div class="server-name">
                    <span>
                        ${server.name} <span class="ip-small">(${server.ip_address})</span>
                        ${server.memo ? `<span class="memo-small"> - ${server.memo}</span>` : ''}
                    </span>
                    <span class="time-ago">${getTimeAgo(server.last_ping)}</span>
                </div>
                <div class="metrics">
                    <div class="metric-item">
                        <span class="label">CPU</span>
                        <span class="value ${server.cpu_usage > 90 ? 'high' : ''}">${server.cpu_usage.toFixed(0)}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="label">MEM</span>
                        <span class="value ${server.mem_usage > 90 ? 'high' : ''}">${server.mem_usage.toFixed(0)}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="label">DSK</span>
                        <span class="value">${server.disk_usage.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Update failed:', error);
    }
}

function showDetails(serverId) {
    const server = currentServers.find(s => s.id === serverId);
    if (!server) return;

    currentServerId = serverId;
    document.getElementById('modal-server-name').innerText = server.name;
    document.getElementById('modal-memo-input').value = server.memo || '';
    
    const specList = document.getElementById('modal-spec-list');
    
    let specs = {};
    try {
        specs = JSON.parse(server.specs || '{}');
    } catch (e) {
        specs = { "Info": server.specs };
    }

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

    document.getElementById('detail-modal').style.display = 'flex';
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
            updateDashboard(); // 즉시 대시보드 갱신
        } else {
            alert('Failed to save memo.');
        }
    } catch (error) {
        console.error('Save failed:', error);
        alert('An error occurred while saving.');
    }
}

function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
    currentServerId = null;
}

window.onclick = function(event) {
    const modal = document.getElementById('detail-modal');
    if (event.target == modal) {
        closeModal();
    }
}

setInterval(updateDashboard, 10000);
updateDashboard();
