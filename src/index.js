const ProviderEngine = require("web3-provider-engine");
const HookedWalletEthTxSubprovider = require("web3-provider-engine/subproviders/hooked-wallet-ethtx");
const FiltersSubprovider = require("web3-provider-engine/subproviders/filters.js");
const NonceSubprovider = require("web3-provider-engine/subproviders/nonce-tracker.js");
const { privateToAddress } = require("ethereumjs-util");
const httpProvider = require("./providers/httpProvider.js");

function ZeusProvider (options = {}) {

    this.options = Object.assign({
        rpcApis: [],
        privateKeys: []
    }, options);

    /**
     * @type {Map<string, Buffer>}
     */
    const accounts = this.options.privateKeys.reduce((map, privateKey) => {
        map.set("0x" + privateToAddress("0x" + privateKey).toString("hex"), privateKey);
        return map;
    }, new Map());
    this.httpProvidersList = this.options.rpcApis.map(url => new httpProvider(url));
    this.currentProvider = 0;
    this.engine = new ProviderEngine();

    this.engine.addProvider(new FiltersSubprovider());
    this.engine.addProvider(new NonceSubprovider());
    this.engine.addProvider(new HookedWalletEthTxSubprovider({
        getAccounts: () => {
            return Array.from(accounts.keys());
        },
        getPrivateKey: (address) => {
            return accounts.get(address);
        }
    }));

    this.engine.start();

}

ZeusProvider.prototype.getCurrentProvider = function () {
    return this.httpProvidersList[this.currentProvider];
};

ZeusProvider.prototype.switchToNextProvider = function () {
    const from = this.options.rpcApis[this.currentProvider];
    this.currentProvider = (this.currentProvider + 1) % this.httpProvidersList.length;
    if (typeof this.options.onRpcProviderChange === "function") {
        this.options.onRpcProviderChange(from, this.options.rpcApis[this.currentProvider]);
    }
    return this.currentProvider;
};

ZeusProvider.prototype.send = function (payload) {
    console.warn(`Warning! Synchronous send in httpProvider is triggered.`);
    return this.getCurrentProvider().send(payload);
};

ZeusProvider.prototype.sendAsync = function (payload, callback) {
    
    const request = () => this.getCurrentProvider().sendAsync(payload, handle);
    let attempts = 1;

    const handle = (err, res) => {
        if (err) {
            if (attempts++ >= 2 * this.httpProvidersList.length) { // Run twice along all http providers
                return callback(err, res); // Get the error up
            }
            this.switchToNextProvider();
            return setTimeout(request, 25);
        }
        callback(err, res);
    }
    
    return request();

};

module.exports = ZeusProvider;