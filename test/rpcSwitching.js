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

    function mockRpc (url, status = 200, times = 1) {
        return nock(url)
            .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                return body.method === "eth_blockNumber";
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

});