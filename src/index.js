const ProviderEngine = require("web3-provider-engine");
const HookedWalletEthTxSubprovider = require("web3-provider-engine/subproviders/hooked-wallet-ethtx");
const FiltersSubprovider = require("web3-provider-engine/subproviders/filters.js");
const NonceSubprovider = require("web3-provider-engine/subproviders/nonce-tracker.js");
const FetchSubprovider = require("web3-provider-engine/subproviders/fetch.js");
const { privateToAddress } = require("ethereumjs-util");

function ZeusProvider (options = {}) {

    /**
     * @type {Map<string, Buffer>}
     */
    const accounts = (options.privateKeys || []).reduce((map, privateKey) => {
        map.set("0x" + privateToAddress("0x" + privateKey).toString("hex"), privateKey);
        return map;
    }, new Map());

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
    if (options.rpcApis && options.rpcApis.length) {
        this.engine.addProvider(new FetchSubprovider({
            rpcUrl: options.rpcApis[0]
        }));
    }

    this.engine.start();

}

ZeusProvider.prototype.sendAsync = function() {
    this.engine.sendAsync.apply(this.engine, arguments);
};
  
ZeusProvider.prototype.send = function() {
    return this.engine.send.apply(this.engine, arguments);
};

module.exports = ZeusProvider;