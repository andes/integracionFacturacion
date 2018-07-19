import * as http from 'http';
import * as ConfigPrivate from './../../config.private';

// declare const Promise;

function doGet(path) {
    return new Promise((resolve: any, reject: any) => {
        let options = {
            host: ConfigPrivate.StaticConfiguration.andesApi.ip,
            port: ConfigPrivate.StaticConfiguration.andesApi.port,
            Authentication: ConfigPrivate.StaticConfiguration.secret.token,
            path: path,
            headers: {
                'Authorization': ConfigPrivate.StaticConfiguration.secret.token,
                'Content-Type': 'application/json'
            }
        }

        let req = http.get(options, function (res) {
            res.on('data', function (body) {
                resolve(JSON.parse(body.toString()));
            });
        });

        req.on('error', function (e) {
            reject(e.message);
        });

        req.end();
    });
}

function doPost(path) {
    return new Promise((resolve: any, reject: any) => {
        let options = {
            method: "POST",
            host: ConfigPrivate.StaticConfiguration.andesApi.ip,
            port: ConfigPrivate.StaticConfiguration.andesApi.port,
            Authentication: ConfigPrivate.StaticConfiguration.secret.token,
            path: path,
            headers: {
                'Authorization': ConfigPrivate.StaticConfiguration.secret.token,
                'Content-Type': 'application/json'
            }
        }

        let result: any;

        let req = http.request(options, function (res) {
            let total = '';
            res.on('data', function (body) {
                total += body
            });

            res.on('end', function () {
                resolve(JSON.parse(total));
            });
        });

        req.on('error', function (e) {
            reject(e.message);
        });

        req.end();
    });
}


export async function getTurnosFacturacionPendiente() {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/facturacion/SUMAR/turnos');
}

export async function getEfector(idEfector) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/efector/' + idEfector);
}


export async function cambioEstado(idTurno) {
    return await doPost(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/cambioEstado/' + idTurno);
}

export async function getPrestacionesPorTurno(idTurno) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/prestacionPorTurno/' + idTurno);
}
