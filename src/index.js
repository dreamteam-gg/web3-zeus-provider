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

ZeusProvider.prototype.switchToNextProvider = function (err, res) {
    const from = this.options.rpcApis[this.currentProvider];
    this.currentProvider = (this.currentProvider + 1) % this.httpProvidersList.length;
    if (typeof this.options.onRpcProviderChange === "function") {
        this.options.onRpcProviderChange({
            from: from,
            to: this.options.rpcApis[this.currentProvider],
            error: err,
            response: res || null
        });
    }
    return this.currentProvider;
};

ZeusProvider.prototype.send = function (payload) {
    console.warn(`[ZeusTokenProvider] Warning! Synchronous send in httpProvider is triggered.`);
    return this.getCurrentProvider().send(payload);
};

ZeusProvider.prototype.sendAsync = function (payload, callback) {

    let attempts = 1;
    const handle = (err, res) => {
        if (err) {
            if (attempts++ >= 2 * this.httpProvidersList.length) { // Run twice along all http providers
                return callback(err, res); // Get the error up
            }
            this.switchToNextProvider(err, res);
            return setTimeout(request, 25);
        }
        callback(err, res);
    }
    const request = () => this.getCurrentProvider().sendAsync(payload, handle);
    
    return request();

};

module.exports = ZeusProvider;