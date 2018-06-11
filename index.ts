import { SipsDBConfiguration } from './config.private'
import * as andesService from './lib/andes.service';
import * as sipsService from './lib/sips.service';
import * as andesServiceRF from './lib/recuperoFinanciero/andes.service';
import * as andesServiceSUMAR from './lib/sumar/andes.service';
import * as sipsServiceSUMAR from './lib/sumar/sips.service';
import * as sipsServiceRF from './lib/recuperoFinanciero/sips.service';
import * as moment from 'moment';
// import * as Verificator from './lib/verificador';

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
    let turnosFacturacion: any = await andesService.getTurnosFacturacionPendiente();
    let datosSumar = [];
    let datosRecupero = [];

    for (let i = 0; i < turnosFacturacion.length; i++) {
        turnoFacturacion = turnosFacturacion[i];

        if (pacienteAplicaSUMAR(turnoFacturacion.turno.paciente)) {
            datosSumar.push(turnoFacturacion);
        }  else {
            datosRecupero.push(turnoFacturacion);
        }

        await facturarSumar(datosSumar);
        await facturarRecupero(datosRecupero);
    }
    //  await facturarPrestacionSinturno(pool);
    sql.close();

    function pacienteAplicaSUMAR(paciente) {
        return (turnoFacturacion.turno.paciente.obraSocial
            && turnoFacturacion.turno.paciente.obraSocial.codigo === '499'  // CODIGO DE OBRA SOCIAL 'SUMAR'
        );
    }

    async function facturarSumar(datosPrestaciones: any) {
        let datosPrestacion;
        for (let i = 0; i < datosPrestaciones.length; i++) {
            datosPrestacion = datosPrestaciones[i];
            let afiliadoSumar = await sipsServiceSUMAR.getAfiliadoSumar(pool, datosPrestacion.turno.paciente.documento);
     
            if (afiliadoSumar) {
                let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
                let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);
                let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                 let nomenclador: any = await andesService.getConfiguracionPrestacion(datosPrestacion.turno.tipoPrestacion.conceptId);
                let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, nomenclador.nomencladorSUMAR.id);

                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud)
                let codigoPatologia = 'A98';
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';

                let codigo = crearCodigoComp(comprobante, datosPrestacion.datosAgenda, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                let prestacion = await creaPrestaciones(datosPrestacion.turno.horaInicio, idComprobante, codigo, pacienteSips, nomencladorSips, datosPrestacion.datosAgenda);
                let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, prestacion);

                if (idPrestacion) {
                    let idTurno = datosPrestacion.turno._id
                    cambioEstadoTurno(idTurno)
                }
            }
        }
    }

    async function facturarPrestacionSinturno(pool) {
        let prestaciones: any = await andesService.getPrestacionesSinTurno('2091000013100');
        for (let index = 0; index < prestaciones.length; index++) {
            let prestacion = prestaciones[index];

            // compruebo que este en afiliados
            let afiliadoSumar = await sipsServiceSUMAR.getAfiliadoSumar(pool, prestacion.paciente.documento);
            if (afiliadoSumar) {
                // mapeo con el efector
                let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(prestacion.createdBy.organizacion._id);
                // creacion del json para el comprobante
                let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                // insert del comprobante y devuelve id
                let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                // mapeo paciente
                let pacienteSips = await sipsServiceSUMAR.mapeoPaciente(pool, prestacion.paciente.documento);
                // PARA TESTEO ENVIO CONCEPTID DE OTOEMISION
                let nomenclador: any = await andesService.getConfiguracionPrestacion('2091000013100');
                let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, nomenclador.nomencladorSUMAR.id);

                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud)
                let codigoPatologia = 'A98';
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';
                let codigo = crearCodigoComp(comprobante, prestacion.createdAt, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                 let unaPrestacion = await creaPrestaciones(prestacion.createdAt, idComprobante, codigo, pacienteSips, nomencladorSips, prestacion.createdAt);
                 let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, unaPrestacion);
            }
        }
    }

    function crearComprobante(efector, clavebeneficiario, idAfiliado) {
        return {
            cuie: efector,
            fechaComprobante: new Date(),
            claveBeneficiario: clavebeneficiario,
            idAfiliado: idAfiliado,
            fechaCarga: new Date(),
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

        return codigoFinal;
    }

    async function creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips, datosAgenda) {
        let prestacion = {
            id: null,
            id_comprobante: idComprobante,
            id_nomenclador: nomencladorSips.id,
            cantidad: 1,
            codigo: codigo,
            sexo: (pacienteSips.idSexo === 3 ? 'M' : pacienteSips.idSexo === 2 ? 'F' : 1),
            edad: moment(datosAgenda.fecha).diff(pacienteSips.fechaNacimiento, 'years'),
            // fechaPrestacion: moment(fechaPrestacion).format('YYYY-MM-DD'),
            fechaPrestacion: new Date(datosPrestacion),
            anio: moment(datosPrestacion).format('YYYY'),
            mes: moment(datosPrestacion).format('MM'),
            dia: moment(datosPrestacion).format('DD'),
            // fechaNacimiento: moment(datosPaciente.fechaNacimiento).format('YYYY-MM-DD'),
            fechaNacimiento: new Date(pacienteSips.fechaNacimiento),
            precio_prestacion: nomencladorSips.precio,
            id_anexo: 301,
            diagnostico: 'A98' // HARDCODED
        }

        return prestacion;
    }

    function cambioEstadoTurno(id) {
        andesServiceSUMAR.cambioEstado(id);
    }

    // async function prestacionesSinTurno(conceptId) {

    // }

    async function facturarRecupero(datosPrestaciones: any) {
        let datosPrestacion;
        for (let i = 0; i < datosPrestaciones.length; i++) {
            datosPrestacion = datosPrestaciones[i];

            let orden = ordenFactory();
            let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
            let efector = await sipsService.mapeoEfector(pool, codigoEfectorCUIE);
            let idServicio = await sipsService.mapeoServicio(pool, 148); // PARAMETRO HARDCODEADO ???????
            let idPacienteSips;
            let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);

            if (!pacienteSips) {
                let resultadoBusquedaPaciente: any = await andesService.getPaciente(datosPrestacion.turno.paciente.id);
                pacienteSips = sipsService.pacienteSipsFactory(resultadoBusquedaPaciente, efector.idEfector);
                idPacienteSips = await sipsService.insertaPacienteSips(pacienteSips);
            } else {
                idPacienteSips = pacienteSips.idPaciente;
            }

            let unProfesional: any = await andesService.getProfesional(datosPrestacion.datosAgenda.profesionales[0]._id);
            let rfProfesional = await sipsService.mapeoProfesional(pool, unProfesional.documento);
            let rfObraSocial = (datosPrestacion.turno.paciente.obraSocial && datosPrestacion.turno.paciente.obraSocial.codigo) ? await sipsService.mapeoObraSocial(pool, datosPrestacion.turno.paciente.obraSocial.codigo) : null;
            let codificacion = datosPrestacion.turno.motivoConsulta ? datosPrestacion.turno.motivoConsulta : getCodificacion(datosPrestacion);
            // QUEDA PENDIENTE EL DIAGNOSTICO ...
            // let rfDiagnostico = (codificacion) ? await mapeoDiagnostico(codificacion) : null;
            let configuracionPrestacion: any = await andesService.getConfiguracionPrestacion(datosPrestacion.turno.tipoPrestacion.conceptId);
            let codNomenclador = configuracionPrestacion ? configuracionPrestacion.nomencladorRecuperoFinanciero : '42.01.01';
            let idTipoNomenclador = await sipsServiceRF.getTipoNomenclador(pool, rfObraSocial, datosPrestacion.turno.horaInicio);
            let nomenclador = await sipsServiceRF.mapeoNomenclador(pool, codNomenclador, idTipoNomenclador);
            let rfTipoPractica = nomenclador.idTipoPractica;

            crearOrden(orden, datosPrestacion.turno.horaInicio, efector.idEfector, idServicio, idPacienteSips, rfProfesional, rfTipoPractica, rfObraSocial, codificacion);
            orden.idOrden = await sipsServiceRF.guardarOrden(pool, orden);

            let ordenDetalleSips = crearOrdenDetalle(orden, nomenclador);
            await sipsServiceRF.guardarOrdenDetalle(pool, ordenDetalleSips);

            cambioEstadoTurno(datosPrestacion.turno._id);
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

        let codificacion = (datosPrestaciones.diagnostico && datosPrestaciones.diagnostico.codificaciones[0]) ? datosPrestaciones.codificaciones[0] : null;

        if (codificacion) {
            if (codificacion.codificacionAuditoria && codificacion.codificacionAuditoria.codigo) {
                result = codificacion.codificacionAuditoria.codigo;
            } else if (codificacion.codificacionProfesional.cie10 && codificacion.codificacionProfesional.cie10.codigo) {
                result = codificacion.codificacionProfesional.cie10.codigo;
            }
        }

        return result;
    }

    function crearOrden(orden, fecha, rfEfector, rfServicio, rfPaciente, rfProfesional, rfTipoPractica, rfObraSocial, rfDiagnostico) {
        orden.idEfector = rfEfector;
        orden.idServicio = rfServicio;
        orden.idPaciente = rfPaciente;
        orden.idProfesional = rfProfesional;
        orden.idTipoPractica = rfTipoPractica;
        orden.idObraSocial = rfObraSocial;
        orden.observaciones = rfDiagnostico;
        orden.fecha = fecha;
        orden.fechaPractica = fecha; // Fecha de práctica es lo mismo que fecha de turno?
    }

    function crearOrdenDetalle(orden, nomenclador) {
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
}
