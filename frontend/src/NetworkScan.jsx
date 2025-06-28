import { useEffect, useState } from 'react';

export default function NetworkScan({ onHostsDetected }) {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/scan')
      .then((res) => {
        if (!res.ok) throw new Error('Erreur réseau');
        return res.json();
      })
      .then((data) => {
        setHosts(data.hosts);
        setLoading(false);
        if (onHostsDetected) onHostsDetected(data.hosts);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Scan en cours…</p>;
  if (error) return <p>Erreur : {error}</p>;

  return (
    <div>
      <h2>Hôtes détectés :</h2>
      {hosts.length === 0 ? (
        <p>Aucun hôte détecté</p>
      ) : (
        <ul>
          {hosts.map((ip) => (
            <li key={ip}>{ip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
