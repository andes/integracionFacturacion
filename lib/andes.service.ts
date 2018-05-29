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

export async function getTurnosFacturacionPendiente() {
    return await doGet(ConfigPrivate.StaticConfiguration.URL.facturacionAutomatica + '/facturacion/SUMAR/turnos');
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
