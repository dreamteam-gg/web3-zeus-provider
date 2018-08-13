/**
 * Sub-provider for provider engine.
 * @see https://github.com/MetaMask/provider-engine/blob/master/subproviders/subprovider.js
 */
module.exports = class SubProvider {

    setEngine (engine) {
        const self = this;
        self.engine = engine;
        engine.on("block", (block) => {
            self.currentBlock = block;
        });
    }

    handleRequest () {
        throw new Error("SubProviders should override `handleRequest`.");
    }

    emitPayload (payload, cb) {
        const self = this;
        self.engine.sendAsync(createPayload(payload), cb);
    }

}