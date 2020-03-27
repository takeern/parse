import express = require('express');
const bodyParser = require('body-parser')
import { Request, Response } from 'express';

interface IOption {
    onRequestData?: Function;
    onCreateSuccess?: Function;
    onCreateError?: Function;
    port?: number;
}

export default class Serve {
    private onRequestData: Function;
    private onCreateSuccess: Function;
    private onCreateError: Function;
    private port: number;
    private app: express.Application;
    constructor(p?: IOption) {
        this.port = p.port || 3000;
        this.onCreateError = p.onCreateError;
        this.onRequestData = p.onRequestData;
        this.onCreateSuccess = p.onCreateSuccess;
        this.createServe();
    }

    private createServe() {
        try {
            const app: express.Application = express();
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
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
            app.listen(this.port, () => {
                if (this.onCreateSuccess) {
                    this.onCreateSuccess();
                }
            });
            this.app = app;
        } catch(e) {
            if (this.onCreateError) {
                this.onCreateError(e);
            } else {
                throw e;
            }
        }
    }

    private handleRequest(path: string, req: Request) {
        let res : {
            code: number,
            data?: any,
        } = {
            code: -1,
        };
        if (this.onRequestData) {
            res.data = this.onRequestData(path, req);
            res.code = 100;
        }
        return res;
    }
}