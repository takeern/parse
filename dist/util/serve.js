"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const bodyParser = require('body-parser');
const path = require('path');
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
            app.use(express.static(__dirname + '/../../parse-web'));
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Headers', 'Range');
                next();
            });
            app.use(bodyParser());
            app.get('/', (req, res) => {
                const data = this.handleRequest('/', req);
                res.json(data);
            });
            app.get('/getParseData', (req, res) => {
                const data = this.handleRequest('/getParseData', req);
                res.json(data);
            });
            app.get('/getBuffer', (req, res) => {
                const data = this.handleRequest('/getBuffer', req);
                if (data.data && data.data.pipe) {
                    res.type('application/octet-stream');
                    data.data.pipe(res);
                }
                else {
                    res.send(data);
                }
            });
            app.get('/parse', (req, res) => {
                res.sendFile(path.resolve(__dirname + '/../../parse-web/dist/index.html'));
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