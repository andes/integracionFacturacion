import * as http from 'http';
import * as ConfigPrivate from './../config.private';


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

        let result: any;

        let req = http.get(options, function (res) {
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
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/facturacion/turnos');
}

export async function getPaciente(idPaciente) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.mpi + '/pacientes/' + idPaciente);
}

export async function getProfesional(idProfesional) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.tm + '/profesionales/' + idProfesional);
}

export async function getConfiguracionPrestacion(conceptId) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/configuracionPrestacion/' + conceptId);
}

export async function getPrestacionesSinTurno() {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/sinTurno');
}

export async function getPrestacionesConTurno(id) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/prestacionesConTurno/' + id);
}

export async function busquedaHuds(id,idPrestacion,expresion) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.rup + '/prestaciones/huds/' + id + '?idPrestacion='+idPrestacion+'&expresion='+expresion+'');
}

export async function getObraSocial(documento) {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.module + '/fuentesAutenticas/puco/' + documento);
}

export async function cambioEstadoPrestacion(id) {
    return await doPost(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/cambioEstadoPrestaciones/' + id);
}
