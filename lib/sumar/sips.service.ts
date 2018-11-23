// import * as sql from 'mssql';
import * as http from 'http';
import { SipsDBConfiguration } from '../../config.private';
import { DateTime } from 'mssql';
const sql = require('mssql');

export async function mapeoPaciente(pool, dni) {
    let query = 'SELECT TOP 1 * FROM dbo.Sys_Paciente where activo=1 and numeroDocumento=@dni order by objectId DESC;';
    let result = await new sql.Request(pool)
        .input('dni', sql.VarChar(50), dni)
        .query(query);

    return result.recordset[0] ? result.recordset[0] : null;
}

export async function saveComprobanteSumar(pool, datosComprobante) {
    let query = 'INSERT INTO dbo.PN_comprobante (cuie, id_factura, nombre_medico, fecha_comprobante, clavebeneficiario, id_smiafiliados, fecha_carga, comentario, marca, periodo, activo, idTipoDePrestacion,objectId,factAutomatico) ' +
        ' values (@cuie, NULL, NULL, @fechaComprobante, @claveBeneficiario, @idAfiliado, @fechaCarga, @comentario, @marca, @periodo, @activo, @idTipoPrestacion, @objectId, @factAutomatico)' +
        ' SELECT SCOPE_IDENTITY() AS id';

    let result = await new sql.Request(pool)
        .input('cuie', sql.VarChar(10), datosComprobante.cuie)
        .input('fechaComprobante', sql.DateTime, datosComprobante.fechaComprobante)
        .input('claveBeneficiario', sql.VarChar(50), datosComprobante.claveBeneficiario)
        .input('idAfiliado', sql.Int, datosComprobante.idAfiliado)
        .input('fechaCarga', sql.DateTime, datosComprobante.fechaCarga)
        .input('comentario', sql.VarChar(500), datosComprobante.comentario)
        .input('marca', sql.VarChar(10), datosComprobante.marca)
        .input('periodo', sql.VarChar(7), datosComprobante.periodo)
        .input('activo', sql.VarChar(1), datosComprobante.activo)
        .input('idTipoPrestacion', sql.Int, datosComprobante.idTipoPrestacion)
        .input('objectId', sql.VarChar(50), datosComprobante.objectId)
        .input('factAutomatico', sql.VarChar(50), 'prestacion')
        .query(query);

    return result && result.recordset ? result.recordset[0].id : null;
}

export async function mapeoNomenclador(pool, idNomenclador) {
    let query = 'SELECT * FROM [dbo].[PN_nomenclador] where id_nomenclador = @idNomenclador';
    let resultado = await new sql.Request(pool)
        .input('idNomenclador', sql.VarChar(50), idNomenclador)
        .query(query);

    let res = null;
    if (resultado.recordset[0]) {
        res = {
            id: resultado.recordset[0].id_nomenclador,
            precio: resultado.recordset[0].precio,
            codigo: resultado.recordset[0].codigo,
            grupo: resultado.recordset[0].grupo
        }
    }

    return res;
}

export async function mapeoEfector(pool, codigoCUIE) {
    let query = 'SELECT * FROM dbo.Sys_efector WHERE cuie = @codigo';
    let resultado = await new sql.Request(pool)
        .input('codigo', sql.VarChar(50), codigoCUIE)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;
}


export async function getAfiliadoSumar(pool, documento) {
    let query = 'SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @documento AND activo = @activo';
    let resultado = await new sql.Request(pool)
        .input('documento', sql.VarChar(50), documento)
        .input('activo', sql.VarChar(1), 'S')
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;
}

export async function insertPrestaciones(pool, prestacion) {
    let query = 'INSERT INTO [dbo].[PN_prestacion] ([id_comprobante],[id_nomenclador],[cantidad],[precio_prestacion],[id_anexo],[peso],[tension_arterial],[diagnostico],[edad],[sexo],[codigo_comp],[fecha_nacimiento],[fecha_prestacion],[anio],[mes],[dia]' +
        // ',[fecha_nacimiento],[fecha_prestacion],[anio],[mes],[dia]' +
        ')' +
        ' VALUES (@idComprobante,@idNomenclador,@cantidad,@precioPrestacion,@idAnexo,@peso,@tensionArterial,@diagnostico,@edad,@sexo,@codigoComp,@fechaNacimiento,@fechaPrestacion,@anio,@mes,@dia' +
        // ',@fechaNacimiento,@fechaPrestacion,@anio,@mes,@dia' +
        ')' +
        'SELECT SCOPE_IDENTITY() AS id';

    pool = await new sql.ConnectionPool(SipsDBConfiguration).connect();
    let result = await new sql.Request(pool)
        .input('idComprobante', sql.Int, prestacion.id_comprobante)
        .input('idNomenclador', sql.Int, prestacion.id_nomenclador)
        .input('cantidad', sql.Int, 1) // Valor por defecto
        .input('precioPrestacion', sql.Decimal, prestacion.precio_prestacion)
        .input('idAnexo', sql.Int, 301) // Valor por defecto (No corresponde)
        .input('peso', sql.Decimal, 0)
        .input('tensionArterial', sql.VarChar(7), '00/00')
        .input('diagnostico', sql.VarChar(500), prestacion.diagnostico)
        .input('edad', sql.VarChar(2), prestacion.edad)
        .input('sexo', sql.VarChar(2), prestacion.sexo)
        .input('codigoComp', sql.VarChar(100), prestacion.codigo)
        .input('fechaNacimiento', sql.DateTime, prestacion.fechaNacimiento)
        .input('fechaPrestacion', sql.DateTime, prestacion.fechaPrestacion)
        .input('anio', sql.Int, prestacion.anio)
        .input('mes', sql.Int, prestacion.mes)
        .input('dia', sql.Int, prestacion.dia)

        //    .input('talla', sql.Int, talla)
        //    .input('perimetroCefalico', sql.VarChar(10), perimetroCefalico)
        //    .input('semanasGestacion', sql.Int, semanasGestacion)
        .query(query);

    if (result && result.recordset) {
        let idPrestacion = result.recordset[0].id;
        let idDatoReportable = 1; // getIdDatoReportable();
        let valor = 1;

        return idPrestacion;

    }

    pool.close();
}


export async function insertDatosReportables(pool, datos) {
    let query = 'INSERT INTO [dbo].[PN_Rel_PrestacionXDatoReportable] ([idPrestacion],[idDatoReportable],[valor]) VALUES (@idPrestacion ,@idDatoReportable ,@valor)';
    let resultado = await new sql.Request(pool)
        .input('idPrestacion', sql.Int, datos.idPrestacion)
        .input('idDatoReportable', sql.Int, datos.idDatoReportable)
        .input('valor', sql.VarChar(30), datos.valor)
        .query(query);
    console.log(resultado)
    // return resultado.recordset[0] ? resultado.recordset[0] : null;

}
