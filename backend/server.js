const express = require("express");
const cors = require("cors");
const ping = require("ping");
const dns = require("dns").promises;
const { exec } = require("child_process");
const mdns = require("multicast-dns")();

const app = express();
app.use(cors());

// Détection du type d’équipement par OUI MAC (plus complet et logs)
function detectDeviceType(mac) {
  if (!mac) {
    console.log("MAC manquant => type unknown");
    return "unknown";
  }
  const normalizedMac = mac.toUpperCase().replace(/-/g, ":");
  const oui = normalizedMac.split(":").slice(0, 3).join(":");
  console.log(`MAC reçue: ${mac} => OUI: ${oui}`);

  const ouiMap = {
    "00:1E:33": "printer",
    "00:50:56": "vm",
    "00:1C:42": "vm",
    "FC:FB:FB": "box",
    "00:23:AE": "router",
    "00:25:9C": "router",
    "28:F6:8B": "router",
    "3C:5A:B4": "pc",
    "F4:5C:89": "pc",
  };
  const type = ouiMap[oui] || "pc";
  console.log(`Type détecté: ${type}`);
  return type;
}

// Lire la table ARP pour obtenir les IP et MAC (Windows compatible)
function getArpTable() {
  return new Promise((resolve) => {
    exec("arp -a", (err, stdout) => {
      if (err) {
        console.error("Erreur commande arp:", err);
        return resolve([]);
      }
      const lines = stdout.split("\n");
      const table = [];

      for (let line of lines) {
        // Exemple de ligne Windows :  192.168.1.1          00-23-AE-XX-XX-XX     dynamique
        const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([a-fA-F0-9\-]{17})/);
        if (match) {
          const ip = match[1];
          const mac = match[2].replace(/-/g, ":").toLowerCase();
          table.push({ ip, mac });
        }
      }
      console.log("Table ARP:", table);
      resolve(table);
    });
  });
}

// Scan réseau : ping + reverse DNS + MAC + type
async function scanNetwork(baseIp = "192.168.1.", start = 1, end = 254, concurrency = 50) {
  const liveHosts = [];
  const ips = [];
  for (let i = start; i <= end; i++) {
    ips.push(`${baseIp}${i}`);
  }

  for (let i = 0; i < ips.length; i += concurrency) {
    const batch = ips.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(ip => ping.promise.probe(ip, { timeout: 1 }))
    );
    results.forEach((res, idx) => {
      if (res.alive) {
        liveHosts.push(batch[idx]);
      }
    });
  }

  const arpTable = await getArpTable();

  const enriched = await Promise.all(
    liveHosts.map(async (ip) => {
      let hostname = null;
      try {
        const resolved = await dns.reverse(ip);
        hostname = resolved[0];
      } catch {}

      const macEntry = arpTable.find((entry) => entry.ip === ip);
      const mac = macEntry ? macEntry.mac : null;
      const type = detectDeviceType(mac);

      return { ip, hostname, mac, type };
    })
  );

  return enriched;
}

// Scan mDNS (smartphones, appareils IoT...)
function scanMdns(timeout = 5000) {
  return new Promise((resolve) => {
    const devices = new Map();

    mdns.on("response", (response) => {
      response.answers.forEach((answer) => {
        if (answer.type === "A" || answer.type === "AAAA") {
          devices.set(answer.name, answer.data);
        }
      });
    });

    mdns.query({
      questions: [{
        name: "_services._dns-sd._udp.local",
        type: "PTR",
      }],
    });

    setTimeout(() => {
      mdns.removeAllListeners("response");
      resolve(Array.from(devices.entries()).map(([name, ip]) => ({
        ip,
        hostname: name,
        mac: null,
        type: "mdns-device",
      })));
    }, timeout);
  });
}

// Route ping+arp
app.get("/scan", async (req, res) => {
  console.log("Scan réseau (ping + arp) lancé...");
  try {
    const devices = await scanNetwork();
    console.log(`Scan terminé. Hôtes actifs : ${devices.length}`);
    res.json({ devices });
  } catch (err) {
    console.error("Erreur lors du scan :", err);
    res.status(500).json({ error: err.message });
  }
});

// Route mDNS
app.get("/scan-mdns", async (req, res) => {
  console.log("Scan mDNS lancé...");
  try {
    const devices = await scanMdns(5000);
    console.log(`Scan mDNS terminé. Appareils trouvés : ${devices.length}`);
    res.json({ devices });
  } catch (err) {
    console.error("Erreur lors du scan mDNS :", err);
    res.status(500).json({ error: err.message });
  }
});

// Route complète : ping + arp + mDNS
app.get("/scan-full", async (req, res) => {
  console.log("Scan complet lancé...");
  try {
    const [networkDevices, mdnsDevices] = await Promise.all([
      scanNetwork(),
      scanMdns(5000),
    ]);
    const allDevicesMap = new Map();
    networkDevices.forEach(dev => allDevicesMap.set(dev.ip, dev));
    mdnsDevices.forEach(dev => {
      if (!allDevicesMap.has(dev.ip)) {
        allDevicesMap.set(dev.ip, dev);
      }
    });
    const allDevices = Array.from(allDevicesMap.values());
    console.log(`Scan complet terminé. Total appareils : ${allDevices.length}`);
    res.json({ devices: allDevices });
  } catch (err) {
    console.error("Erreur lors du scan complet :", err);
    res.status(500).json({ error: err.message });
  }
});

// *** AJOUT DE LA ROUTE RACINE POUR ÉVITER LE 404 ***
app.get("/", (req, res) => {
  res.send("API backend OK");
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
