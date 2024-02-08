const {createClient} = require('@vercel/edge-config');

class ConfigSingleton {
    constructor() {
        if (ConfigSingleton.instance) {
            return ConfigSingleton.instance;
        }

        this.config = createClient(process.env.EDGE_CONFIG);
        ConfigSingleton.instance = this;
    }
}

module.exports = ConfigSingleton;