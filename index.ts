import {SipsDBConfiguration} from './config.private'
import * as andesService from './lib/andes.service';
import * as sipsService from './lib/sips.service';
import * as andesServiceRF from './lib/recuperoFinanciero/andes.service';
import * as andesServiceSUMAR from './lib/sumar/andes.service';
import * as sipsServiceSUMAR from './lib/sumar/sips.service';
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
    console.log('before connect')
    let pool = await sql.connect(SipsDBConfiguration);
    console.log('after connect')
    let turnoFacturacion;
    let turnosFacturacion : any = await andesServiceSUMAR.getTurnosFacturacionPendiente();
    let datosSumar = [];0
    let datosRecupero = [];
    
    for (let i = 0; i < turnosFacturacion.length; i++) {
        turnoFacturacion = turnosFacturacion[i];

        if (pacienteAplicaSUMAR(turnoFacturacion.turno.paciente)) {
            datosSumar.push(turnoFacturacion);
        } 
        else { // SI NO APLICA SUMAR VA A RECUPERO POR DEFECTO???
            datosRecupero.push(turnoFacturacion);
        }

        await facturarSumar(pool, datosSumar);
        // await facturarRecupero(pool, datosRecupero);
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
                let pacienteSips = await sipsServiceSUMAR.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);
                console.log("aca paciente",pacienteSips)
                // await sipsServiceSUMAR.insertBeneficiario(pool, pacienteSips, null); // NO VA!
                
                let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                console.log(idComprobante);
                // if (datosPrestacion.tipoPrestacion) {
                //     nomenclador = await andesServiceSUMAR.getConfiguracionPrestacion(datosPrestacion.tipoPrestacion.conceptId);
                // }

                // PARA TESTEO ENVIO CONCEPTID DE OTOEMISION
                let nomenclador : any = await andesServiceSUMAR.getConfiguracionPrestacion('2091000013100');
                console.log('nomenclador', nomenclador);
                let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, nomenclador.nomencladorSUMAR.id);
                console.log('nomencladorSips', nomencladorSips);
    
                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud) 
                let codigoPatologia = 'A98';
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';
                
                let codigo = crearCodigoComp(comprobante, datosPrestacion.datosAgenda, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                let prestacion = await creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips, datosPrestacion.datosAgenda);
                let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, prestacion);
            console.log(idPrestacion);
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
    let sexo = (pacienteSips.idSexo === 3 ? 'M' : pacienteSips.idSexo === 2 ? 'F' : 1);
    let grupo = nomenclador.grupo;
    let codigo = nomenclador.codigo;
    let fechaPrestParseada = moment(datosAgenda.fecha).format('YYYY') + '' + moment(datosAgenda.fecha).format('MM') + '' + moment(datosAgenda.fecha).format('DD');
    let fechaNacParseada = moment(fechaNac).format('YYYY') + '' + moment(fechaNac).format('MM') + '' + moment(fechaNac).format('DD');
    let codigoFinal = cuie + fechaPrestParseada + claveB + sexo + fechaNacParseada + edad + grupo + codigo + diagnostico + codigoProfesional;

    console.log('codigoFinal inicio', codigoFinal, 'codigoFinal FIN')
    return codigoFinal;
}

async function creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips,datosAgenda) {
    console.log('creaPrestaciones datosPrestacion');
    let prestacion = {
        id: null,
        id_comprobante: idComprobante,
        id_nomenclador: nomencladorSips.id,
        cantidad: 1,
        codigo: codigo,
        sexo: (pacienteSips.idSexo === 3 ? 'M' : pacienteSips.idSexo === 2 ? 'F' : 1),
        edad:  moment(datosAgenda.fecha).diff(pacienteSips.fechaNacimiento, 'years'),
        // fechaPrestacion: moment(fechaPrestacion).format('YYYY-MM-DD'),
        fechaPrestacion: datosPrestacion.turno.horaInicio,
        anio: moment(datosPrestacion.turno.horaInicio).format('YYYY'),
        mes: moment(datosPrestacion.turno.horaInicio).format('MM'),
        dia: moment(datosPrestacion.turno.horaInicio).format('DD'),
        // fechaNacimiento: moment(datosPaciente.fechaNacimiento).format('YYYY-MM-DD'),
        fechaNacimiento: pacienteSips.fechaNacimiento,
        precio_prestacion: nomencladorSips.precio,
        id_anexo: 301,
        diagnostico: 'A98' // HARDCODED 
    }

    return prestacion;
}

async function facturarRecupero(pool, datosPrestaciones: any) {
    console.log('facturarRecupero')
    let datosPrestacion;
    for (var i = 0; i < datosPrestaciones.length; i++) {
        datosPrestacion = datosPrestaciones[i];
        let orden = ordenFactory();
        // let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
        let codigoEfectorCUIE = 'Q06391';

        // let idEfector = await sipsService.mapeoEfector(pool, datosPrestacion.efector.id);
        let idServicio = await sipsService.mapeoServicio(pool, 148); //PARAMETRO HARDCODEADO ???????
        let idPacienteSips = await sipsService.mapeoPaciente(pool, datosPrestaciones.paciente.documento);

        if (!idPacienteSips) {
            let resultadoBusquedaPaciente: any = await andesService.getPaciente(datosPrestaciones.paciente.id);
            console.log(resultadoBusquedaPaciente)
            let idNivelCentral = 127; // Por defecto seteamos como efector nivel central (ID 127)
            let pacienteSips = sipsService.pacienteSipsFactory(resultadoBusquedaPaciente.paciente, idNivelCentral);
           // idPacienteSips = await sipsService.insertaPacienteSips(pacienteSips);
        }
        let unProfesional: any = await andesService.getProfesional(datosPrestaciones.profesionales[0]._id);
        // let rfProfesional = await mapeoProfesional(unProfesional.documento);
        // let rfObraSocial = (turnoRF.paciente.obraSocial && turnoRF.paciente.obraSocial.codigo) ? await mapeoObraSocial(turnoRF.paciente.obraSocial.codigo) : null;

        // let codificacion = turnoRF.motivoConsulta ? turnoRF.motivoConsulta : getCodificacion(turnoRF.diagnostico, turnoRF);
        // // let rfDiagnostico = (codificacion) ? await mapeoDiagnostico(codificacion) : null;
        // let codNomenclador = await getNomencladorByConceptId(turnoRF.tipoPrestacion.conceptId);
        // let idTipoNomenclador = await getTipoNomenclador(rfObraSocial, turnoRF.fecha);
        // let nomenclador = await mapeoNomenclador(codNomenclador, idTipoNomenclador);
        // let rfTipoPractica = nomenclador.idTipoPractica;

        // crearOrden(orden, turnoRF, idEfector, idServicio, idPacienteSips, rfProfesional, rfTipoPractica, rfObraSocial, codificacion);
        // orden.idOrden = await guardarOrden(orden);

        // let ordenDetalleSips: any = await crearOdenDetalle(orden, nomenclador);
        // ordenDetalleSips.idOrdenDetalle = await guardarOrdenDetalle(ordenDetalleSips);
        // orden.detalles.push(ordenDetalleSips);
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