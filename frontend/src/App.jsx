import { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone/esm/vis-network";

const successSound = new Audio("/success.mp3");

export default function App() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const networkInstance = useRef(null);

  const scanNetwork = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:3001/scan-full");
      if (!res.ok) throw new Error("Erreur lors du scan réseau");
      const data = await res.json();
      setDevices(data.devices || []);
      successSound.play();
    } catch (err) {
      setError(err.message || "Erreur inconnue");
    }
    setLoading(false);
  };

  useEffect(() => {
    scanNetwork();
  }, []);

  useEffect(() => {
    if (!networkInstance.current) {
      const container = document.getElementById("network-map");
      const options = {
        nodes: {
          shape: "dot",
          size: 20,
          font: {
            size: 14,
            color: "#ffffff",
          },
          borderWidth: 2,
        },
        edges: {
          color: "#64ffda",
          width: 2,
          smooth: true,
        },
        physics: {
          enabled: true,
          stabilization: true,
          barnesHut: {
            gravitationalConstant: -2000,
            springLength: 150,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 100,
          hideEdgesOnDrag: false,
        },
        layout: {
          improvedLayout: true,
        },
      };
      networkInstance.current = new Network(container, { nodes: new DataSet(), edges: new DataSet() }, options);
    }

    // Préparation des noeuds
    const nodes = devices.map((device, i) => ({
      id: i,
      label: device.hostname || device.name || "Inconnu",
      title: `IP: ${device.ip || "-"}`,
      color: device.type === "unknown" ? "#999999" : "#28a745",
      shape: "dot",
      size: 20,
    }));

    // Création des liens en chaîne simple (device i relié à device i+1)
    const edges = devices.length > 1
      ? devices.slice(1).map((_, i) => ({
          from: i,
          to: i + 1,
          color: "#64ffda",
          width: 2,
        }))
      : [];

    // Mise à jour du graphe
    networkInstance.current.setData({
      nodes: new DataSet(nodes),
      edges: new DataSet(edges),
    });
  }, [devices]);

  function getDeviceIcon(type) {
    switch (type) {
      case "mdns-device":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="device-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z" />
            <path d="M12 18h.01" />
          </svg>
        );
      case "box":
      case "router":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="device-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="7" width="18" height="10" rx="2" ry="2" />
            <path d="M7 17v2" />
            <path d="M17 17v2" />
          </svg>
        );
      case "printer":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="device-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="6" y="9" width="12" height="7" rx="2" ry="2" />
            <path d="M6 13h12" />
            <path d="M9 9V5h6v4" />
          </svg>
        );
      case "pc":
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="device-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        );
    }
  }

  // Calcul des stats
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.type !== "unknown").length;
  const offlineDevices = devices.filter(d => d.type === "unknown").length;

  return (
    <main className="app-container">
      {/* Top row */}
      <div className="top-row">
        <div className="scan-control">
          <h2>🧭 Contrôle du scan</h2>
          <div className="button-row">
            <button onClick={scanNetwork} disabled={loading}>
              🚀 {loading ? "Scan en cours…" : "Lancez Scan"}
            </button>
            <button onClick={scanNetwork} disabled={loading}>
              🔄 Rafraîchir
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="network-stats">
          <h2>📊 Statistiques réseau</h2>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-number">{totalDevices}</div>
              <div className="stat-label">Total des appareils</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{onlineDevices}</div>
              <div className="stat-label">En ligne</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{offlineDevices}</div>
              <div className="stat-label">Hors ligne</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{devices.filter(d => d.type === "unknown").length}</div>
              <div className="stat-label">Inconnu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: map + device list */}
      <section className="main-content">
        <div className="network-map">
          <h2>🌐 Cartographie réseau</h2>
          <div className="map-container" id="network-map"></div>
        </div>

        <aside className="device-list">
          <h2>🖥️ Appareils détectés</h2>
          <ul>
            {devices.map((d, i) => {
              let statusColor = "#999"; // gris par défaut = inconnu
              if (d.type === "unknown") statusColor = "#999";
              else if (
                d.type === "mdns-device" ||
                d.type === "pc" ||
                d.type === "router" ||
                d.type === "box" ||
                d.type === "printer"
              )
                statusColor = "#28a745"; // vert = en ligne
              else statusColor = "#dc3545"; // rouge = hors ligne

              return (
                <li key={i} className="device-item">
                  {getDeviceIcon(d.type)}
                  <div className="device-info">
                    <span className="device-name">{d.hostname || d.name || "Inconnu"}</span>
                    <span className="device-ip">{d.ip || "-"}</span>
                  </div>
                  <span
                    className="status-dot"
                    style={{ backgroundColor: statusColor }}
                    title={
                      statusColor === "#28a745"
                        ? "En ligne"
                        : statusColor === "#dc3545"
                        ? "Hors ligne"
                        : "Inconnu"
                    }
                  />
                </li>
              );
            })}
          </ul>
        </aside>
      </section>
    </main>
  );
}
