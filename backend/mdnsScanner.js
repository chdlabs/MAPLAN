const mdns = require('multicast-dns')();

function scanMdns(timeout = 5000) {
  return new Promise((resolve) => {
    const devices = new Map();

    mdns.on('response', (response) => {
      response.answers.forEach((answer) => {
        if (answer.type === 'A' || answer.type === 'AAAA') {
          // Utilise le nom + IP pour identifier
          devices.set(answer.name, answer.data);
        }
      });
    });

    // Question standard pour découvrir les services
    mdns.query({
      questions: [{
        name: '_services._dns-sd._udp.local',
        type: 'PTR',
      }],
    });

    // Après un timeout, on arrête et on renvoie les résultats
    setTimeout(() => {
      mdns.removeAllListeners('response');
      resolve(Array.from(devices.entries()).map(([name, ip]) => ({ name, ip })));
    }, timeout);
  });
}

module.exports = scanMdns;
