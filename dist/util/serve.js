"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
class Serve {
    constructor(p) {
        this.port = p.port || 3000;
        this.onCreateError = p.onCreateError;
        this.onRequestData = p.onRequestData;
        this.onCreateSuccess = p.onCreateSuccess;
        this.createServe();
    }
    createServe() {
        try {
            const app = express();
            app.get('/', (req, res) => {
                const data = this.handleRequest('/', req);
                res.json(data);
            });
            app.get('/getParseData', (req, res) => {
                const data = this.handleRequest('/', req);
                res.json(data);
            });
            app.listen(this.port, () => {
                if (this.onCreateSuccess) {
                    this.onCreateSuccess();
                }
            });
            this.app = app;
        }
        catch (e) {
            if (this.onCreateError) {
                this.onCreateError(e);
            }
            else {
                throw e;
            }
        }
    }
    handleRequest(path, req) {
        let res = {
            code: -1,
        };
        if (this.onRequestData) {
            res.data = this.onRequestData(path, req);
            res.code = 100;
        }
        return res;
    }
}
exports.default = Serve;
//# sourceMappingURL=serve.js.map