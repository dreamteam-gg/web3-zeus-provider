const assert = require("assert");
const Web3 = require("web3");
const ZeusProvider = require("..");
const nock = require("nock");

describe("RPC switching tests", function() {

    const expectedBlockNumber = 100500;
    const rpcs = [
        "http://localhost:1111",
        "http://localhost:2222",
        "http://localhost:3333"
    ];
    let web3;

    beforeEach(function () {
        web3 = new Web3(new ZeusProvider({
            rpcApis: rpcs
        }));
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

            const callback = [];
            const zeusProvider = new ZeusProvider({
                rpcApis: [
                    "https://localhost:1111",
                    "https://localhost:2222"
                ],
                privateKeys: [
                    "FCAFC28AF87287F3AB81554C2DF38C3FCE6E2C7654DB7710243A2D52A9EDF441"
                ],
                onRpcProviderChange: ({ from, to, error, response }) => callback.push(from, to, error, response)
            });
            const web3 = new Web3(zeusProvider);

            const expectedBlockNumber = 100500;
            const handler1 = nock("https://localhost:1111")
                .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                    return body.method === "eth_blockNumber";
                })
                .reply(502, "Bad gateway");
            const handler2 = nock("https://localhost:2222")
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
            assert.equal(callback[0], "https://localhost:1111");
            assert.equal(callback[1], "https://localhost:2222");
            assert.equal(callback[2] instanceof Error, true);

            handler1.done();
            handler2.done();

        });

    });

});