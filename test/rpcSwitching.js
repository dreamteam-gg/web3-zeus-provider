const assert = require("assert");
const Web3 = require("web3");
const ZeusProvider = require("..");
const nock = require("nock");

describe("RPC switching tests", function() {

    const expectedBlockNumber = 100500;
    let callbacks = [];
    const rpcs = [
        "http://localhost:1111",
        "http://localhost:2222",
        "http://localhost:3333"
    ];
    let web3;

    before(() => {
        const expect = (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [] }
            return body.method === "eth_getBlockByNumber";
        };
        const handle = (_, body) => ({
            jsonrpc: "2.0",
            id: body.id,
            result: {
                number: expectedBlockNumber,
                hash: "0x0",
                nonce: 1,
                transactions: []
            }
        });
        nock("http://localhost:1111").post("/", expect).times(1000000).reply(200, handle);
        nock("http://localhost:2222").post("/", expect).times(1000000).reply(200, handle);
        nock("http://localhost:3333").post("/", expect).times(1000000).reply(200, handle); 
    });

    beforeEach(() => {
        web3 = new Web3(new ZeusProvider({
            rpcApis: rpcs,
            onRpcProviderChange: (res) => callbacks.push(res)
        }));
    });

    afterEach(() => {
        web3.currentProvider.terminate();
    });

    function mockRpc (url, status = 200, times = 1, method = "eth_blockNumber") {
        return nock(url)
            .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                return method ? body.method === method : true;
            })
            .times(times)
            .reply(status, (_, body) => (status !== 200 ? "Duck." : {
                jsonrpc: "2.0",
                id: body.id,
                result: expectedBlockNumber
            }));
    }

    function mockRpcTimeout (url) {
        return nock(url)
            .post("/")
            .replyWithError({code: 'ETIMEDOUT'});
    }

    describe("Simple switching", function () {

        it("Should not switch initially", async () => {
            
            const handler = mockRpc(rpcs[0]);
            const block = await web3.eth.getBlockNumber();
            assert.equal(block, expectedBlockNumber);
            handler.done();

        });

        it("Should switch to second RPC in case when first one doesn't work", async () => {

            const handler1 = mockRpc(rpcs[0], 502);
            const handler2 = mockRpc(rpcs[1]);
            const block = await web3.eth.getBlockNumber();
            assert.equal(block, expectedBlockNumber);
            handler1.done();
            handler2.done();

        });

        it("Should switch to third RPC in case all doesn't work", async () => {
            
            const handler1 = mockRpc(rpcs[0], 502);
            const handler2 = mockRpcTimeout(rpcs[1]);
            const handler3 = mockRpc(rpcs[2]);
            const block = await web3.eth.getBlockNumber();
            assert.equal(block, expectedBlockNumber);
            handler1.done();
            handler2.done();
            handler3.done();

        });

    });

    describe("Second round switch handling", function () {

        it("Should switch RPCs two times", async () => {
            
            const handler1 = mockRpc(rpcs[0], 502);
            const handler2 = mockRpcTimeout(rpcs[1]);
            const handler3 = mockRpc(rpcs[2], 404);
            const handler4 = mockRpc(rpcs[0]);
            const block = await web3.eth.getBlockNumber();
            assert.equal(block, expectedBlockNumber);
            handler1.done();
            handler2.done();
            handler3.done();
            handler4.done();

        });

        it("Should error if all RPCs error 2 times", async () => {
            
            const handler1 = mockRpc(rpcs[0], 502, 2);
            const handler2 = mockRpcTimeout(rpcs[1], 404, 2);
            const handler3 = mockRpcTimeout(rpcs[2], 502, 2);
            try {
                await web3.eth.getBlockNumber();
                assert.fail("Should fail");
            } catch (e) {
                assert.ok(true);
            }
            handler1.done();
            handler2.done();
            handler3.done();

        });

    });

    describe("Features", () => {

        it("Should trigger RPC changed callback on RPC change", async () => {

            callbacks = [];

            const expectedBlockNumber = 100500;
            const handler1 = nock("http://localhost:1111")
                .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                    return body.method === "eth_blockNumber";
                })
                .reply(502, "Bad gateway");
            const handler2 = nock("http://localhost:2222")
                .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                    return body.method === "eth_blockNumber";
                })
                .reply(200, (_, body) => ({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: expectedBlockNumber
                }));
            const block = await web3.eth.getBlockNumber();

            assert.equal(block, expectedBlockNumber);
            const switched = callbacks.pop();
            assert.equal(switched.from, "http://localhost:1111");
            assert.equal(switched.to, "http://localhost:2222");
            assert.equal(switched.error instanceof Error, true);

            handler1.done();
            handler2.done();

        });

    });

    describe("Handling errors", () => {

        it("Should throw an error on RPC error", async function () {

            const blockHash = "0x8533b0f58142eeb2e8003717316e568e2fc5cb14f0f4b9ec40f2e5ec53e453c0";
            const handler1 = nock("http://localhost:1111")
                .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                    return body.method === "eth_getBlockByHash" && body.params[0] === blockHash;
                })
                .reply(200, {
                    "jsonrpc":"2.0",
                    "id":1,
                    "error": {
                        "code": -32602,
                        "message": "invalid argument 0: json: cannot unmarshal hex string of odd length into Go value of type common.Hash"
                    }
                });

            try {
                const block = await web3.eth.getBlock(blockHash);
                assert.fail("Must throw an error");
            } catch (e) {
                assert.ok(true);
            }

            handler1.done();

        });

        it("Should throw an error after X not successful attempts", async function () {

            const callbacks = [];
            const rpcs = [
                "http://localhost:1238",
                "http://localhost:1239"
            ];
            const web3 = new Web3(new ZeusProvider({
                rpcRetries: 2,
                rpcApis: rpcs,
                onRpcProviderChange: (res) => callbacks.push(res)
            }));
            mockRpc(rpcs[0], 502, 50, "eth_getBlockByHash");
            mockRpc(rpcs[1], 502, 50, "eth_getBlockByHash");
            mockRpc(rpcs[0], 200, 50, null);
            mockRpc(rpcs[1], 200, 50, null);

            try {
                const block = await web3.eth.getBlock("0x8533b0f58142eeb2e8003717316e568e2fc5cb14f0f4b9ec40f2e5ec53e453d1");
                assert.fail("Must throw an error");
            } catch (e) {
                assert.ok(true);
            }

            assert.equal(callbacks.length, 4);
            web3.currentProvider.terminate();

        });

        it("Exit if all block number retrieval attempts fail", async function () {

            const callbacks = [];
            const rpcs = [
                "http://localhost:1355",
                "http://localhost:1399"
            ];
            mockRpc(rpcs[0], 502, 50, null);
            mockRpc(rpcs[1], 502, 50, null);
            const web3 = new Web3(new ZeusProvider({
                rpcRetries: 2,
                rpcApis: rpcs,
                onRpcProviderChange: (res) => callbacks.push(res)
            }));

            try {
                await web3.eth.getBlockNumber();
                assert.fail("Must throw an error");
            } catch (e) {
                assert.ok(true);
            }

            // assert.equal(callbacks.length > 4, true);
            web3.currentProvider.terminate();

        });

    });

});