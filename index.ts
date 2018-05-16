import {SipsDBConfiguration} from './config.private'
import * as andesService from './lib/andes.service';
import * as sipsService from './lib/sips.service';
import * as moment from 'moment';
// import * as queries from './lib/queries/queries';
import * as Verificator from './lib/verificador';

const sql = require('mssql');

let toArray = (stream): Promise<any[]> => {
    let array = [];    
    return new Promise((resolve, reject) => {
        stream.on('data', (doc) => {
            array.push(doc);
        }).on('end', () => {
            return resolve(array);
        }).on('error', reject);
    });
};

export async function ejecutar() {
    sql.close();
    let pool = await sql.connect(SipsDBConfiguration);
    let turnoFacturacion;
    let turnosFacturacion : any = await andesService.getTurnosFacturacionPendiente();
    let datosSumar = [];
    let datosFacturacion = [];

    for (let i = 0; i < turnosFacturacion.length; i++) {
        turnoFacturacion = turnosFacturacion[i];

        if (pacienteAplicaSUMAR(turnoFacturacion.turno.paciente)) {
            datosSumar.push(turnoFacturacion);
        } 
        // else {
        //     unPacienteRF = {
        //         _id: turno._id,
        //         profesionales: agenda.profesionales,
        //         tipoPrestacion: turno.tipoPrestacion,
        //         diagnostico: turno.diagnostico,
        //         efector: agenda.organizacion,
        //         paciente: turno.paciente,
        //         fecha: turno.horaInicio,
        //         motivoConsulta: turno.motivoConsulta,
        //     };

        //     pacientesRF.push(unPacienteRF);
        // }

        await facturarSumar(datosSumar, pool);
    }

    sql.close();

    function pacienteAplicaSUMAR(paciente) {
        console.log('turnoFacturacion.turno.paciente.obraSocial', turnoFacturacion.turno.paciente.obraSocial)
        // return (turnoFacturacion.turno.paciente.obraSocial 
        //     && turnoFacturacion.turno.paciente.obraSocial.codigo === '499'  //CODIGO DE OBRA SOCIAL 'SUMAR'
        // );
        return true;
    }

    async function facturarSumar(datosPrestaciones: any, pool) {
        // console.log('facturarSumar',datosPrestaciones );
        for (var i = 0; i < datosPrestaciones.length; i++) {
            let datosPrestacion = datosPrestaciones[i];
            let afiliadoSumar = await sipsService.getAfiliadoSumar(datosPrestacion.turno.paciente.documento, pool);
            
            if (afiliadoSumar) {
                // let codigoEfectorCUIE = await andesService.getEfector(datosPrestacion.datosAgenda.organizacion._id);
                let codigoEfectorCUIE = 'Q06391';
                // let efector = await sipsService.mapeoEfector(codigoEfectorCUIE);
                let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                let pacienteSips = await sipsService.mapeoPaciente(datosPrestacion.turno.paciente.documento, pool);
        
                await sipsService.insertBeneficiario(pacienteSips, null, pool); // ??? Este método va o no va?
                let idComprobante = await sipsService.saveComprobanteSumar(comprobante, pool);
                let nomenclador : any = await andesService.getConfiguracionPrestacion(datosPrestacion.tipoPrestacion.conceptId);
    
                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud) 
                let codigoPatologia = 'A98';
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';
                
                let codigo = crearCodigoComp(comprobante, datosPrestacion.datosAgenda, pacienteSips, nomenclador, codigoPatologia, codigoProfesional);
    
                // savePrestacionSUMAR(prestacion, idComprobante, datosPaciente.fechaNacimiento, datosPaciente.sexo, datosPaciente.edad, codigo);
                // savePrestacionSumar(idComprobante, nomenclador, datosPaciente)
    
            }
        }
    }
}

function crearComprobante(efector, clavebeneficiario, idAfiliado) {
    return {
        cuie: efector ,
        fechaComprobante: moment().format('YYYYMMDD'),
        claveBeneficiario: clavebeneficiario,
        idAfiliado: idAfiliado,
        fechaCarga: moment().format('YYYYMMDD'),
        comentario: 'Carga Automática',
        marcaS: 0,
        periodo: moment(new Date, 'YYYY/MM/DD').format('YYYY') + '/' + moment(new Date, 'YYYY/MM/DD').format('MM'),
        activo: 'S',
        idTipoPrestacion: 1
    }
}

function crearCodigoComp(datosComprobante, datosAgenda, pacienteSips, nomenclador, diagnostico, codigoProfesional) {
    let cuie = datosComprobante.cuie; 
    let claveB = datosComprobante.claveBeneficiario;
    let fechaNac = pacienteSips.fechaNacimiento;
    let edad = moment(datosAgenda.fecha).diff(pacienteSips.fechaNacimiento, 'years');
    let sexo = pacienteSips.sexo;
    let grupo = nomenclador.grupo;
    let codigo = nomenclador.codigo;
    let fechaPrestParseada = moment(datosAgenda.fecha).format('YYYY') + '' + moment(datosAgenda.fecha).format('MM') + '' + moment(datosAgenda.fecha).format('DD');
    let fechaNacParseada = moment(fechaNac).format('YYYY') + '' + moment(fechaNac).format('MM') + '' + moment(fechaNac).format('DD');
    let codigoFinal = cuie + fechaPrestParseada + claveB + sexo + fechaNacParseada + edad + grupo + codigo + diagnostico + codigoProfesional;

    console.log('codigoFinal inicio', codigoFinal, 'codigoFinal FIN')
    return codigoFinal;
}