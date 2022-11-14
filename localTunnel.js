const localTunnel = require('localtunnel');

await localTunnel(process.env.PORT || 3000, { subdomain: "vi-duty-bot" }, function(err, tunnel) {
    console.log('localTunnel running')
});