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
    console.log('iniciando..Cantidad de turnos: ', turnosFacturacion.length)
    for (let i = 0; i < turnosFacturacion.length; i++) {
        turnoFacturacion = turnosFacturacion[i];
        if (pacienteAplicaSUMAR(turnoFacturacion.turno.paciente)) {
            datosSumar.push(turnoFacturacion);
        } else {
            datosRecupero.push(turnoFacturacion);
        }


    }
    // await facturarSumar(datosSumar);
    //await facturarPrestacionSinturnoSumar(pool);
    await facturarRecupero(datosRecupero);
    await   facturarPrestacionSinturnoRF(pool)
    sql.close();

    function pacienteAplicaSUMAR(paciente) {
        return (turnoFacturacion.turno.paciente.obraSocial
            && turnoFacturacion.turno.paciente.obraSocial.codigo === '499'  // CODIGO DE OBRA SOCIAL 'SUMAR'
        );
    }


    //SUMAR
    async function facturarSumar(datosPrestaciones: any) {

        let datosPrestacion;
        console.log("sumar", datosPrestaciones)
        for (let i = 0; i < datosPrestaciones.length; i++) {
            datosPrestacion = datosPrestaciones[i];
            let afiliadoSumar = await sipsServiceSUMAR.getAfiliadoSumar(pool, datosPrestacion.turno.paciente.documento);

            if (afiliadoSumar) {
                console.log('----- SUMAR -----')
                let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
                let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);
                let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                let nomenclador: any = await andesService.getConfiguracionPrestacion(datosPrestacion.turno.tipoPrestacion.conceptId);
                let configPrestaciones = await matchConceptId(datosPrestacion.turno._id, 'conTurno', null);
                let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, configPrestaciones.nomencladorSUMAR.id);
                console.log('id comprobante', idComprobante);
                // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud)
                let codigoPatologia = await diagnosticos(configPrestaciones, datosPrestacion.turno._id, 'conTurno', null);
                // Valor de codigoProfesional por defecto es P99
                let codigoProfesional = 'P99';
                let codigo = crearCodigoComp(comprobante, datosPrestacion.datosAgenda, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                let prestacion = await creaPrestaciones(datosPrestacion.turno.horaInicio, idComprobante, codigo, pacienteSips, nomencladorSips, datosPrestacion.datosAgenda, codigoPatologia);
                let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, prestacion);
                console.log('id prestacion:', idPrestacion)
                let prestConTurno: any = await andesService.getPrestacionesConTurno(datosPrestacion.turno._id)
                let datosReportables
                if (datosPrestacion.turno.tipoPrestacion.conceptId === "2091000013100") {
                    datosReportables = await datosReportablesOto(configPrestaciones, datosPrestacion.turno._id, 'conTurno', null, idPrestacion)
                } else {
                    datosReportables = await datosReportablesGeneral(configPrestaciones, datosPrestacion.turno.paciente.id, idPrestacion, prestConTurno[0].id)
                }
                // // console.log(arrayDatosReportables);
                for (let index = 0; index < datosReportables.length; index++) {
                    const element = datosReportables[index];
                    await sipsServiceSUMAR.insertDatosReportables(pool, element);

                }

                // if (idPrestacion) {
                //     let idTurno = datosPrestacion.turno._id
                //     cambioEstadoTurno(idTurno)
                // }
                console.log('----- FIN SUMAR -----')
            }

        }
    }

    async function facturarPrestacionSinturnoSumar(pool) {
        console.log("prestaciones sin turno")
        let prestaciones: any = await andesService.getPrestacionesSinTurno();
        console.log("prestaciones", prestaciones)
        for (let index = 0; index < prestaciones.length; index++) {
            let prestacion = prestaciones[index];
            let obraSocialPuco: any = await andesService.getObraSocial(prestacion.paciente.documento)
            if (obraSocialPuco.codigo === '499') {
                // compruebo que este en afiliados
                let afiliadoSumar = await sipsServiceSUMAR.getAfiliadoSumar(pool, prestacion.paciente.documento);
                if (afiliadoSumar) {
                    console.log("------prestaciones sin turno-------")
                    // mapeo con el efector
                    let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(prestacion.createdBy.organizacion._id);
                    // creacion del json para el comprobante
                    let comprobante = crearComprobante(codigoEfectorCUIE, afiliadoSumar.clavebeneficiario, afiliadoSumar.id_smiafiliados);
                    // insert del comprobante y devuelve id
                    let idComprobante = await sipsServiceSUMAR.saveComprobanteSumar(pool, comprobante);
                    // mapeo paciente
                    console.log("idComprobante", idComprobante)

                    let pacienteSips = await sipsServiceSUMAR.mapeoPaciente(pool, prestacion.paciente.documento);
                    // PARA TESTEO ENVIO CONCEPTID DE OTOEMISION
                    let nomenclador: any = await andesService.getConfiguracionPrestacion(prestacion.solicitud.tipoPrestacion.conceptId);
                    let configPrestaciones = await matchConceptId(null, "sinTurno", prestacion);
                    console.log("config", configPrestaciones);
                    let nomencladorSips = await sipsServiceSUMAR.mapeoNomenclador(pool, configPrestaciones.nomencladorSUMAR.id);

                    // Valor de codigoPatologia por defecto es A98 (Medicina preven/promoción salud)

                    let codigoPatologia = await diagnosticos(configPrestaciones, null, 'sinTurno', prestacion);
                    console.log('diagnostico', codigoPatologia)
                    // Valor de codigoProfesional por defecto es P99
                    //diagnosticos(prestacion.turno.tipoPrestacion.conceptId, prestacion.turno._id) 
                    let codigoProfesional = 'P99';
                    let codigo = crearCodigoComp(comprobante, prestacion.createdAt, pacienteSips, nomencladorSips, codigoPatologia, codigoProfesional);
                    let unaPrestacion = await creaPrestaciones(prestacion.createdAt, idComprobante, codigo, pacienteSips, nomencladorSips, prestacion.createdAt, codigoPatologia);
                    let idPrestacion = await sipsServiceSUMAR.insertPrestaciones(pool, unaPrestacion);
                    console.log('idPrestacion', idPrestacion);

                    let datosReportables
                    if (prestacion.solicitud.tipoPrestacion.conceptId === "2091000013100") {
                        datosReportables = await datosReportablesOto(configPrestaciones, null, 'sinTurno', prestacion, idPrestacion)
                    } else {
                        let prest = [prestacion]
                        datosReportables = await datosReportablesGeneral(configPrestaciones, prestacion.paciente.id, idPrestacion, prestacion._id)
                    }

                    for (let index = 0; index < datosReportables.length; index++) {
                        const element = datosReportables[index];
                        await sipsServiceSUMAR.insertDatosReportables(pool, element);

                    }

                    if (idPrestacion) {
                        await andesService.cambioEstadoPrestacion(prestacion._id)
                    }
                    console.log("------fin prestaciones sin turno-------")

                }
            }
        }
    }

    async function datosReportablesGeneral(configPrestaciones, idPaciente, idPrestacion, prestConTurno) {
        console.log(prestConTurno)
        console.log(idPaciente)
        let arrayDatosReportables = []
        let sePuedeReportar = true;
        let busqueda
        for (let index = 0; index < configPrestaciones.nomencladorSUMAR.datosReportables.length; index++) {
            if (sePuedeReportar) {
                const element = configPrestaciones.nomencladorSUMAR.datosReportables[index];
                console.log(prestConTurno[0].id, )
                busqueda = await andesService.busquedaHuds(idPaciente, prestConTurno, element.expresion)
                console.log(busqueda)
                if (busqueda.length === 0) {
                    sePuedeReportar = false;
                }
            }
        }

        let registrosBusqueda = busqueda[0].registro.registros;
        let datosR = configPrestaciones.nomencladorSUMAR.datosReportables;
        datosR.forEach(unDatoReportable => {
            unDatoReportable.valores.forEach(unValor => {
                let reg
                let objDatoReportable;
                reg = registrosBusqueda.find(reg => reg.concepto.conceptId === unValor.conceptId)


                console.log("acaaaaaaa", reg)
                objDatoReportable = {
                    idDatoReportable: unDatoReportable.idDatosReportables,
                    idPrestacion: idPrestacion,
                    valor: reg.valor
                };

                arrayDatosReportables.push(objDatoReportable);
            });
        })

        return arrayDatosReportables
    }

    async function matchConceptId(id, condicion, prestacionEntrante) {
        console.log("FUNCIONNNNNNNNNN")

        let match;
        let prestacion: any
        if (condicion === "conTurno") {
            prestacion = await andesService.getPrestacionesConTurno(id)
        } else {
            prestacion = [prestacionEntrante]
        }
        let arrayConceptos = [];
        arrayConceptos.push(prestacion[0].solicitud.tipoPrestacion.conceptId)
        let registros = prestacion[0].ejecucion.registros;
        for (let index = 0; index < registros.length; index++) {
            const unRegistro = registros[index];
            if (unRegistro.concepto.conceptId) {
                arrayConceptos.push(unRegistro.concepto.conceptId)

            }

        }

        for (let index = 0; index < arrayConceptos.length; index++) {
            const unConceptoId = arrayConceptos[index];

            let confPrestaciones: any = await andesService.getConfiguracionPrestacion(unConceptoId);
            if (confPrestaciones) {
                match = confPrestaciones;
            }


        }
        console.log("match", match)
        return match

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

    async function creaPrestaciones(datosPrestacion, idComprobante, codigo, pacienteSips, nomencladorSips, datosAgenda, diagnostico) {
        let prestacion = {
            id: null,
            id_comprobante: idComprobante,
            id_nomenclador: nomencladorSips.id,
            cantidad: 1,
            codigo: codigo,
            sexo: (pacienteSips.idSexo === 3 ? 'M' : pacienteSips.idSexo === 2 ? 'F' : 1),
            edad: moment(datosAgenda.fecha).diff(pacienteSips.fechaNacimiento, 'years'),
            fechaPrestacion: new Date(datosPrestacion),
            anio: moment(datosPrestacion).format('YYYY'),
            mes: moment(datosPrestacion).format('MM'),
            dia: moment(datosPrestacion).format('DD'),
            fechaNacimiento: new Date(pacienteSips.fechaNacimiento),
            precio_prestacion: nomencladorSips.precio,
            id_anexo: 301,
            diagnostico: diagnostico
        }

        return prestacion;
    }

    function cambioEstadoTurno(id) {
        andesServiceSUMAR.cambioEstado(id);
    }

    async function diagnosticos(confPrestaciones, id, condicion, prestacionSinTurno) {

        let prestacionDelTurno: any
        if (condicion === 'conTurno') {
            prestacionDelTurno = await andesService.getPrestacionesConTurno(id);
        } else {
            prestacionDelTurno = [prestacionSinTurno];
        }
        let datosSumar = confPrestaciones.nomencladorSUMAR.diagnostico;
        console.log(datosSumar)
        let resultado;
        let presente = false;
        prestacionDelTurno = prestacionDelTurno[0].ejecucion.registros
        for (var i = 0; i < datosSumar.length; i++) {
            console.log("aca ññegue")
            if (!presente) {
                var element = datosSumar[i];
                for (var n = 0; n < prestacionDelTurno.length; n++) {
                    if (!presente) {
                        //TO DO condicion si es un solo registro directamente poner ese
                        if (datosSumar.length === 1) {
                            resultado = element.diagnostico;
                            console.log("uno solo:", resultado)
                        }
                        else if (element.conceptId === prestacionDelTurno[n].valor.id) {
                            if (!element.predomina) {
                                resultado = element.diagnostico;
                            }
                            if (element.predomina) {
                                resultado = element.diagnostico;
                                presente = true;
                            }

                        }
                    }

                }
            }
        }
        return resultado;

    }
    async function datosReportablesOto(confPrestaciones, id, condicion, prestacionSinTurno, idPrestacion) {
        let prestacionDelTurno: any
        let valorConcat: string = '';
        if (condicion === 'conTurno') {
            prestacionDelTurno = await andesService.getPrestacionesConTurno(id);
        } else {
            prestacionDelTurno = [prestacionSinTurno];
        }
        let datosSumar = confPrestaciones.nomencladorSUMAR.datosReportables;
        let resultado = {
            idDatoReportable: null,
            idPrestacion: idPrestacion,
            valor: null
        };
        prestacionDelTurno = prestacionDelTurno[0].ejecucion.registros
        for (var i = 0; i < datosSumar.length; i++) {

            var sumar = datosSumar[i];
            resultado.idDatoReportable = sumar.idDatosReportables;
            //recorro los registros
            for (var n = 0; n < prestacionDelTurno.length; n++) {
                //recorro los valores de cada registro
                for (var j = 0; j < sumar.valores.length; j++) {
                    let valores = sumar.valores[j]
                    console.log(valores)
                    //verifico si hay algun conceptid en la bd que haga match con los datos de la prestacion
                    if (valores.conceptId === prestacionDelTurno[n].valor.id) {
                        for (var o = 0; o < sumar.valores.length; o++) {
                            let oidos = sumar.valores[o];
                            //verifico nuevamente para armar la estructura del del valor del dato reportable
                            if (prestacionDelTurno[n].concepto.conceptId === oidos.conceptId) {
                                console.log(oidos.valor + "" + valores.valor + "/")
                                valorConcat += oidos.valor + "" + valores.valor + "/"
                            }


                        }
                    }
                }
            }
        }
        resultado.valor = valorConcat.slice(0, -1);
        console.log(resultado)
        return [resultado];
        // await sipsServiceSUMAR.insertDatosReportables(pool, resultado);
    }

    //RECUPERO FINANCIERO
    async function facturarRecupero(datosPrestaciones: any) {
        let datosPrestacion;
        for (let i = 0; i < datosPrestaciones.length; i++) {
            datosPrestacion = datosPrestaciones[i];
            console.log('----- recupero ------')
            let orden = ordenFactory();
            let configuracionPrestacion: any = await andesService.getConfiguracionPrestacion(datosPrestacion.turno.tipoPrestacion.conceptId);
            let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(datosPrestacion.datosAgenda.organizacion._id);
            let efector = await sipsService.mapeoEfector(pool, codigoEfectorCUIE);
            let idServicio = await sipsService.mapeoServicio(pool, configuracionPrestacion.idServicio); // PARAMETRO HARDCODEADO ???????
            let idPacienteSips;
            let pacienteSips = await sipsService.mapeoPaciente(pool, datosPrestacion.turno.paciente.documento);

            if (!pacienteSips) {
                let resultadoBusquedaPaciente: any = await andesService.getPaciente(datosPrestacion.turno.paciente.id);
                pacienteSips = sipsService.pacienteSipsFactory(resultadoBusquedaPaciente, efector.idEfector);
                idPacienteSips = await sipsService.insertaPacienteSips(pacienteSips);
            } else {
                idPacienteSips = pacienteSips.idPaciente;
            }

            let obraSocialPuco: any = await andesService.getObraSocial(datosPrestacion.turno.paciente.documento)
            console.log(obraSocialPuco)
            let unProfesional: any = await andesService.getProfesional(datosPrestacion.datosAgenda.profesionales[0]._id);
            let rfProfesional = await sipsService.mapeoProfesional(pool, unProfesional.documento)
            let rfObraSocial = (obraSocialPuco && obraSocialPuco.codigo) ? await sipsService.mapeoObraSocial(pool, obraSocialPuco.codigo) : null;
            let codificacion = datosPrestacion.turno.motivoConsulta ? datosPrestacion.turno.motivoConsulta : getCodificacion(datosPrestacion);
            // QUEDA PENDIENTE EL DIAGNOSTICO ...
            // let rfDiagnostico = (codificacion) ? await mapeoDiagnostico(codificacion) : null;
            let codNomenclador = configuracionPrestacion ? configuracionPrestacion.nomencladorRecuperoFinanciero : '42.01.01';
            let idTipoNomenclador = await sipsServiceRF.getTipoNomenclador(pool, rfObraSocial, datosPrestacion.turno.horaInicio);
            let nomenclador = await sipsServiceRF.mapeoNomenclador(pool, codNomenclador, idTipoNomenclador);
            let rfTipoPractica = nomenclador.idTipoPractica;
            crearOrden(orden, datosPrestacion.turno.horaInicio, efector.idEfector, idServicio, idPacienteSips, rfProfesional, rfTipoPractica, rfObraSocial, codificacion);
            orden.idOrden = await sipsServiceRF.guardarOrden(pool, orden);
            console.log("numero de orden", orden.idOrden)
            let ordenDetalleSips = crearOrdenDetalle(orden, nomenclador);
            await sipsServiceRF.guardarOrdenDetalle(pool, ordenDetalleSips);
            if (orden.idOrden) {
                cambioEstadoTurno(datosPrestacion.turno._id);
            }
            console.log('----- fin recupero ------')
        }
    }

    async function facturarPrestacionSinturnoRF(pool) {
        console.log("prestaciones sin turno")
        let prestaciones: any = await andesService.getPrestacionesSinTurno();
        for (let index = 0; index < prestaciones.length; index++) {
            let prestacion = prestaciones[index];
            let obraSocialPuco: any = await andesService.getObraSocial(prestacion.paciente.documento)
            console.log(prestacion)
            if (obraSocialPuco.codigo !== '499') {

                console.log('----- recupero ------')
                let orden = ordenFactory();
                let configuracionPrestacion: any = await await andesService.getConfiguracionPrestacion(prestacion.solicitud.tipoPrestacion.conceptId);
                let codigoEfectorCUIE = await andesServiceSUMAR.getEfector(prestacion.createdBy.organizacion._id);
                let efector = await sipsService.mapeoEfector(pool, codigoEfectorCUIE);
                let idServicio = await sipsService.mapeoServicio(pool, configuracionPrestacion.idServicio); // PARAMETRO HARDCODEADO ???????
                let idPacienteSips;
                let pacienteSips = await sipsService.mapeoPaciente(pool, prestacion.paciente.documento);

                if (!pacienteSips) {
                    let resultadoBusquedaPaciente: any = await andesService.getPaciente(prestacion.paciente.id);
                    pacienteSips = sipsService.pacienteSipsFactory(resultadoBusquedaPaciente, efector.idEfector);
                    idPacienteSips = await sipsService.insertaPacienteSips(pacienteSips);
                } else {
                    idPacienteSips = pacienteSips.idPaciente;
                }

                let unProfesional: any = await andesService.getProfesional(prestacion.solicitud.profesional.id);
                let rfProfesional = await sipsService.mapeoProfesional(pool, unProfesional.documento);
                let rfObraSocial = (obraSocialPuco && obraSocialPuco.codigo) ? await sipsService.mapeoObraSocial(pool, obraSocialPuco.codigo) : null;
                let codificacion = prestacion.motivoConsulta ? prestacion.motivoConsulta : getCodificacion(prestacion);
                // QUEDA PENDIENTE EL DIAGNOSTICO ...
                // let rfDiagnostico = (codificacion) ? await mapeoDiagnostico(codificacion) : null;

                let codNomenclador = configuracionPrestacion ? configuracionPrestacion.nomencladorRecuperoFinanciero : '42.01.01';
                let idTipoNomenclador = await sipsServiceRF.getTipoNomenclador(pool, rfObraSocial, prestacion.ejecucion.fecha);
                let nomenclador = await sipsServiceRF.mapeoNomenclador(pool, codNomenclador, idTipoNomenclador);
                console.log("asdasdas", nomenclador)
                let rfTipoPractica = nomenclador.idTipoPractica;

                crearOrden(orden, prestacion.ejecucion.fecha, efector.idEfector, idServicio, idPacienteSips, rfProfesional, rfTipoPractica, rfObraSocial, codificacion);
                orden.idOrden = await sipsServiceRF.guardarOrden(pool, orden);
                console.log(orden.idOrden)
                let ordenDetalleSips = crearOrdenDetalle(orden, nomenclador);
                await sipsServiceRF.guardarOrdenDetalle(pool, ordenDetalleSips);
                if (orden.idOrden) {
                    await andesService.cambioEstadoPrestacion(prestacion._id)
                }
                console.log('----- fin recupero ------')
            }


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
