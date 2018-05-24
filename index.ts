import {SipsDBConfiguration} from './config.private'
import * as andesService from './lib/andes.service';
import * as sipsService from './lib/sips.service';
import * as andesServiceRF from './lib/recuperoFinanciero/andes.service';
import * as andesServiceSUMAR from './lib/sumar/andes.service';
import * as sipsServiceSUMAR from './lib/sumar/sips.service';
import * as sipsServiceRF from './lib/recuperoFinanciero/sips.service';
import * as moment from 'moment';
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
    let datosRecupero = [];
    
    for (let i = 0; i < turnosFacturacion.length; i++) {
        turnoFacturacion = turnosFacturacion[i];

        if (pacienteAplicaSUMAR(turnoFacturacion.turno.paciente)) {
            datosSumar.push(turnoFacturacion);
        }  else {
            datosRecupero.push(turnoFacturacion);
        }

        await facturarSumar(pool, datosSumar);
        await facturarRecupero(pool, datosRecupero);
    }

    sql.close();

    function pacienteAplicaSUMAR(paciente) {
        return (turnoFacturacion.turno.paciente.obraSocial 
            && turnoFacturacion.turno.paciente.obraSocial.codigo === '499'  //CODIGO DE OBRA SOCIAL 'SUMAR'
        );
    }

    async function facturarSumar(pool, datosPrestaciones: any) {
        let datosPrestacion;
        for (var i = 0; i < datosPrestaciones.length; i++) {
            datosPrestacion = datosPrestaciones[i];
            let afiliadoSumar = await sipsServiceSUMAR.getAfiliadoSumar(pool, datosPrestacion.turno.paciente.documento);
            
            if (afiliadoSumar) {
                // let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
                let codigoEfectorCUIE = 'Q06391';
                let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);
                
                // await sipsServiceSUMAR.insertBeneficiario(pool, pacienteSips, null); // NO VA!
                
                let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                
                // if (datosPrestacion.tipoPrestacion) {
                //     nomenclador = await andesServiceSUMAR.getConfiguracionPrestacion(datosPrestacion.tipoPrestacion.conceptId);
                // }

                // PARA TESTEO ENVIO CONCEPTID DE OTOEMISION
                let nomenclador : any = await andesService.getConfiguracionPrestacion('2091000013100');
                console.log('nomenclador', nomenclador);
                let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, nomenclador.nomencladorSUMAR.id);
                console.log('nomencladorSips', nomencladorSips);
    
                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud) 
                let codigoPatologia = 'A98';
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';
                
                let codigo = crearCodigoComp(comprobante, datosPrestacion.datosAgenda, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                let prestacion = await creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips);
                let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, prestacion);
            
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

async function creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips) {
    console.log('creaPrestaciones datosPrestacion');
    let prestacion = {
        id: null,
        id_comprobante: idComprobante,
        id_nomenclador: nomencladorSips.id,
        cantidad: 1,
        codigo: codigo,
        sexo: pacienteSips.sexo,
        edad: pacienteSips.edad,
        // fechaPrestacion: moment(fechaPrestacion).format('YYYY-MM-DD'),
        fechaPrestacion: datosPrestacion.turno.horaInicio,
        anio: moment(datosPrestacion.turno.horaInicio).format('YYYY'),
        mes: moment(datosPrestacion.turno.horaInicio).format('MM'),
        dia: moment(datosPrestacion.turno.horaInicio).format('DD'),
        // fechaNacimiento: moment(datosPaciente.fechaNacimiento).format('YYYY-MM-DD'),
        fechaNacimiento: pacienteSips.fechaNacimiento,
        precio_prestacion: nomencladorSips.precio,
        id_anexo: 301,
        diagnostico: 'A97' // HARDCODED 
    }

    return prestacion;
}

async function facturarRecupero(pool, datosPrestaciones: any) {
    let datosPrestacion;
    for (var i = 0; i < datosPrestaciones.length; i++) {
        datosPrestacion = datosPrestaciones[i];
        let orden = ordenFactory();
        // let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
        let codigoEfectorCUIE = 'Q06391';

        let idEfector = await sipsService.mapeoEfector(pool, codigoEfectorCUIE);
        let idServicio = await sipsService.mapeoServicio(pool, 148); //PARAMETRO HARDCODEADO ???????
        let idPacienteSips;
        let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);

        if (!pacienteSips) {
            let resultadoBusquedaPaciente: any = await andesService.getPaciente(datosPrestacion.turno.paciente.id);
            let idNivelCentral = 127; // Por defecto seteamos como efector nivel central (ID 127)
            let pacienteSips = sipsService.pacienteSipsFactory(resultadoBusquedaPaciente, idNivelCentral);
            idPacienteSips = await sipsService.insertaPacienteSips(pacienteSips);
        } else {
            idPacienteSips = pacienteSips.idPaciente;
        }

        let unProfesional: any = await andesService.getProfesional(datosPrestacion.datosAgenda.profesionales[0]._id);
        let rfProfesional = await sipsService.mapeoProfesional(pool, unProfesional.documento);

        let rfObraSocial = (datosPrestacion.turno.paciente.obraSocial && datosPrestacion.turno.paciente.obraSocial.codigo) ? await sipsService.mapeoObraSocial(pool, datosPrestacion.paciente.obraSocial.codigo) : null;

        let codificacion = datosPrestacion.turno.motivoConsulta ? datosPrestacion.turno.motivoConsulta : getCodificacion(datosPrestaciones);
        // let rfDiagnostico = (codificacion) ? await mapeoDiagnostico(codificacion) : null;
        let configuracionPrestacion : any = await andesService.getConfiguracionPrestacion(datosPrestacion.tipoPrestacion.conceptId);
        let codNomenclador = configuracionPrestacion ? configuracionPrestacion.nomencladorRecuperoFinanciero : '42.01.01'; 
        let idTipoNomenclador = await sipsServiceRF.getTipoNomenclador(pool, rfObraSocial, datosPrestaciones.fecha);
        let nomenclador = await sipsServiceRF.mapeoNomenclador(pool,codNomenclador, idTipoNomenclador);
        let rfTipoPractica = nomenclador.idTipoPractica;

        crearOrden(orden, datosPrestacion, idEfector, idServicio, idPacienteSips, rfProfesional, rfTipoPractica, rfObraSocial, codificacion);
        orden.idOrden = await sipsServiceRF.guardarOrden(pool, orden);

        let ordenDetalleSips: any = await crearOdenDetalle(orden, nomenclador);
        ordenDetalleSips.idOrdenDetalle = await sipsServiceRF.guardarOrdenDetalle(pool, ordenDetalleSips);
        orden.detalles.push(ordenDetalleSips);
    }
}

function ordenFactory() {
    return {
        idOrden: null,
        idEfector: null,
        numero: 1,
        periodo: '0000/00', // en que se factura, se genera luego
        idServicio: null,
        idPaciente: null,
        idProfesional: null,
        fecha: new Date(),
        fechaPractica: new Date(),
        idTipoPractica: null, // revisar como lo relacionamos
        idObraSocial: 0,
        nroAfiliado: '',
        observaciones: null, // diagnostico
        estado: '', // no se pasa
        idUsuarioRegistro: 1,
        fechaRegistro: new Date(),
        idPrefactura: 0,
        idFactura: 0,
        baja: 0,
        codificaHIV: 0,
        monto: 0,
        numeroSiniestro: '',
        fechaSiniestro: new Date('1900-01-01'),
        facturaFueraConvenio: 0,
        esInternacion: 0,
        detalles: [],
    };
}

function getCodificacion(datosPrestaciones) {
    let result = 'sin codificar';
    let codificacion = datosPrestaciones.diagnostico.codificaciones[0] ? datosPrestaciones.codificaciones[0] : null;

    if (codificacion) {
        if (codificacion.codificacionAuditoria && codificacion.codificacionAuditoria.codigo) {
            result = codificacion.codificacionAuditoria.codigo;
        } else if (codificacion.codificacionProfesional.cie10 && codificacion.codificacionProfesional.cie10.codigo) {
            result = codificacion.codificacionProfesional.cie10.codigo;
        }
    }

    return result;
}

function crearOrden(orden, turno, rfEfector, rfServicio, rfPaciente , rfProfesional, rfTipoPractica, rfObraSocial, rfDiagnostico) {
    orden.idEfector = rfEfector;
    orden.idServicio = rfServicio;
    orden.idPaciente = rfPaciente;
    orden.idProfesional = rfProfesional;
    orden.idTipoPractica = rfTipoPractica;
    orden.idObraSocial = rfObraSocial;
    orden.observaciones = rfDiagnostico;
    orden.fecha = turno.fecha;
    orden.fechaPractica = turno.fecha;

    // orden.detalles.push(await crearOdenDetalle(orden));
    // return orden;
}

async function crearOdenDetalle(orden, nomenclador) {
    return {
        idOrdenDetalle: null,
        idOrden: orden.idOrden,
        idEfector: orden.idEfector,
        idNomenclador: nomenclador.idNomenclador,
        descripcion: nomenclador.descripcion,
        cantidad: 1,
        valorUnidad: nomenclador.valorUnidad,
        ajuste: 0,
    };
}
