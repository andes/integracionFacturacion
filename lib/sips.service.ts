import * as moment from 'moment';
import * as http from 'http';
import { SipsDBConfiguration } from '../config.private';
const sql = require('mssql');

export async function mapeoPaciente(pool, dni) {
    let query = 'SELECT TOP 1 * FROM dbo.Sys_Paciente where activo=1 and numeroDocumento=@dni order by objectId DESC;';
    let result = await new sql.Request(pool )
        .input('dni', sql.VarChar(50), dni)
        .query(query);

    return result.recordset[0] ? result.recordset[0] : null;
}

export async function mapeoEfector(pool, codigoCUIE) {
    let query = 'SELECT * FROM dbo.Sys_efector WHERE cuie = @codigo';
    let resultado = await new sql.Request(pool)
        .input('codigo', sql.VarChar(50), codigoCUIE)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;
}

export async function mapeoServicio(pool, id) {
    let query = 'SELECT idServicio FROM dbo.Sys_servicio WHERE idServicio = @id';
    let result = await new sql.Request(pool)
        .input('id', sql.VarChar(50), id)
        .query(query);
    return result.recordset[0] ? result.recordset[0].idServicio : null;
}

export function pacienteSipsFactory(paciente: any, idEfectorSips: any) {
    return {
        idEfector: idEfectorSips,
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        numeroDocumento: paciente.documento,
        idSexo: (paciente.sexo === 'masculino' ? 3 : paciente.sexo === 'femenino' ? 2 : 1),
        fechaNacimiento: moment(paciente.fechaNacimiento).format('YYYYMMDD'),
        idEstado: 3,
        /* Estado Validado en SIPS*/
        idMotivoNI: 0,
        idPais: 54,
        idProvincia: 139,
        idNivelInstruccion: 0,
        idSituacionLaboral: 0,
        idProfesion: 0,
        idOcupacion: 0,
        calle: '',
        numero: 0,
        piso: '',
        departamento: '',
        manzana: '',
        idBarrio: -1,
        idLocalidad: 52,
        idDepartamento: 557,
        idProvinciaDomicilio: 139,
        referencia: '',
        informacionContacto: '',
        cronico: 0,
        idObraSocial: 499,
        idUsuario: '1486739', // ID USUARIO POR DEFECTO
        fechaAlta: moment().format('YYYYMMDD HH:mm:ss'),
        fechaDefuncion: '19000101',
        fechaUltimaActualizacion: moment().format('YYYYMMDD HH:mm:ss'),
        idEstadoCivil: 0,
        idEtnia: 0,
        idPoblacion: 0,
        idIdioma: 0,
        otroBarrio: '',
        camino: '',
        campo: '',
        esUrbano: 1,
        lote: '',
        parcela: '',
        edificio: '',
        activo: 1,
        fechaAltaObraSocial: '19000101',
        numeroAfiliado: null,
        numeroExtranjero: '',
        telefonoFijo: 0,
        telefonoCelular: 0,
        email: '',
        latitud: 0,
        longitud: 0,
        objectId: paciente._id
    };
}

export async function insertaPacienteSips(paciente: any) {
    let idPacienteGrabadoSips;
    let idPaciente = await existepaciente(paciente);

    let result;
    if (idPaciente === 0) {

        let query = 'INSERT INTO dbo.Sys_Paciente ' +
            ' ( idEfector ,' +
            ' apellido , ' +
            ' nombre, ' +
            ' numeroDocumento, ' +
            ' idSexo, ' +
            ' fechaNacimiento, ' +
            ' idEstado, ' +
            ' idMotivoNI, ' +
            ' idPais, ' +
            ' idProvincia, ' +
            ' idNivelInstruccion, ' +
            ' idSituacionLaboral, ' +
            ' idProfesion, ' +
            ' idOcupacion, ' +
            ' calle, ' +
            ' numero, ' +
            ' piso, ' +
            ' departamento, ' +
            ' manzana, ' +
            ' idBarrio, ' +
            ' idLocalidad, ' +
            ' idDepartamento, ' +
            ' idProvinciaDomicilio, ' +
            ' referencia, ' +
            ' informacionContacto, ' +
            ' cronico, ' +
            ' idObraSocial, ' +
            ' idUsuario, ' +
            ' fechaAlta, ' +
            ' fechaDefuncion, ' +
            ' fechaUltimaActualizacion, ' +
            ' idEstadoCivil, ' +
            ' idEtnia, ' +
            ' idPoblacion, ' +
            ' idIdioma, ' +
            ' otroBarrio, ' +
            ' camino, ' +
            ' campo, ' +
            ' esUrbano, ' +
            ' lote, ' +
            ' parcela, ' +
            ' edificio, ' +
            ' activo, ' +
            ' fechaAltaObraSocial, ' +
            ' numeroAfiliado, ' +
            ' numeroExtranjero, ' +
            ' telefonoFijo, ' +
            ' telefonoCelular, ' +
            ' email, ' +
            ' latitud, ' +
            ' longitud, ' +
            ' objectId ) ' +
            ' VALUES( ' +
            paciente.idEfector + ', ' +
            '\'' + paciente.apellido + '\',' +
            '\'' + paciente.nombre + '\', ' +
            paciente.numeroDocumento + ', ' +
            paciente.idSexo + ', ' +
            '\'' + paciente.fechaNacimiento + '\',' +
            paciente.idEstado + ', ' +
            paciente.idMotivoNI + ', ' +
            paciente.idPais + ', ' +
            paciente.idProvincia + ', ' +
            paciente.idNivelInstruccion + ', ' +
            paciente.idSituacionLaboral + ', ' +
            paciente.idProfesion + ', ' +
            paciente.idOcupacion + ', ' +
            '\'' + paciente.calle + '\', ' +
            paciente.numero + ', ' +
            '\'' + paciente.piso + '\', ' +
            '\'' + paciente.departamento + '\', ' +
            '\'' + paciente.manzana + '\', ' +
            paciente.idBarrio + ', ' +
            paciente.idLocalidad + ', ' +
            paciente.idDepartamento + ', ' +
            paciente.idProvinciaDomicilio + ', ' +
            '\'' + paciente.referencia + '\', ' +
            '\'' + paciente.informacionContacto + '\', ' +
            paciente.cronico + ', ' +
            paciente.idObraSocial + ', ' +
            paciente.idUsuario + ', ' +
            '\'' + paciente.fechaAlta + '\', ' +
            '\'' + paciente.fechaDefuncion + '\', ' +
            '\'' + paciente.fechaUltimaActualizacion + '\', ' +
            paciente.idEstadoCivil + ', ' +
            paciente.idEtnia + ', ' +
            paciente.idPoblacion + ', ' +
            paciente.idIdioma + ', ' +
            '\'' + paciente.otroBarrio + '\', ' +
            '\'' + paciente.camino + '\', ' +
            '\'' + paciente.campo + '\', ' +
            paciente.esUrbano + ', ' +
            '\'' + paciente.lote + '\', ' +
            '\'' + paciente.parcela + '\', ' +
            '\'' + paciente.edificio + '\', ' +
            paciente.activo + ', ' +
            '\'' + paciente.fechaAltaObraSocial + '\', ' +
            '\'' + paciente.numeroAfiliado + '\', ' +
            '\'' + paciente.numeroExtranjero + '\', ' +
            '\'' + paciente.telefonoFijo + '\', ' +
            '\'' + paciente.telefonoCelular + '\', ' +
            '\'' + paciente.email + '\', ' +
            '\'' + paciente.latitud + '\', ' +
            '\'' + paciente.longitud + '\', ' +
            '\'' + paciente.objectId + '\' ' +
            ') ' +
            ' select SCOPE_IDENTITY() as id'
        result = await new sql.Request().query(query);
    }
    return (result && result.recordset[0]) ? result.recordset[0].id : null;
}

function existepaciente(paciente) {
    let idpaciente;
    return new Promise((resolve: any, reject: any) => {
        (async function () {
            try {
                let query = 'SELECT idPaciente FROM dbo.Sys_Paciente WHERE objectId = @objectId';
                let result = await new sql.Request()
                    .input('objectId', sql.VarChar(50), paciente.objectId)
                    .query(query);

                if (typeof result[0] !== 'undefined') {
                    idpaciente = result[0].idPaciente;
                    resolve(idpaciente);
                } else {
                    idpaciente = 0;
                    resolve(idpaciente);
                }

            } catch (err) {
                reject(err);
            }
        })();
    });
}

export async function mapeoProfesional(pool, dni) {
    let query = 'SELECT top 1 idProfesional FROM dbo.Sys_Profesional WHERE activo=1 AND numeroDocumento = @dni;';
    let result = await new sql.Request(pool)
        .input('dni', sql.VarChar(50), dni)
        .query(query);

    return result.recordset[0] ? result.recordset[0].idProfesional : 0;
}


export async function mapeoObraSocial(pool, codigoObraSocial) {
    let query = 'SELECT idObraSocial, cod_puco FROM dbo.Sys_ObraSocial WHERE cod_PUCO = @codigo;';
    let result = await new sql.Request(pool)
    .input('codigo', sql.Int,  codigoObraSocial)
    .query(query);
    return result.recordset[0] ? result.recordset[0].idObraSocial : 0;
}
