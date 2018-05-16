// import * as sql from 'mssql';
import * as http from 'http';
const sql = require('mssql')

export async function mapeoPaciente(dni, pool) {
    let query = 'SELECT TOP 1 * FROM dbo.Sys_Paciente where activo=1 and numeroDocumento=@dni order by objectId DESC;';
    let result = await new sql.Request(pool )
        .input('dni', sql.VarChar(50), dni)
        .query(query);

    return result.recordset[0] ? result.recordset[0] : null;
}

export async function insertBeneficiario(pacienteSips, efector, pool) {
    console.log('insertBeneficiario')
    return;
}

export async function saveComprobanteSumar(datosComprobante, pool) {
    console.log('saveComprobanteSumar')
    let query = "INSERT INTO dbo.PN_comprobante ( cuie, id_factura, nombre_medico, fecha_comprobante, clavebeneficiario, id_smiafiliados, " +
        " fecha_carga, comentario, marca, periodo, activo, idTipoDePrestacion) " +
        "values (@cuie," + null + "," + null + ",'" + datosComprobante.fechaComprobante + "'," + "'" + datosComprobante.claveBeneficiario + "'" +
        "," + datosComprobante.idAfiliado + ",'" + datosComprobante.fechaCarga + "','" + datosComprobante.comentario + "', @marca,'" + 
        datosComprobante.periodo + "','" + datosComprobante.activo + "'," + datosComprobante.idTipoPrestacion + ")";
    
    let result = await new sql.Request(pool)
        .input('cuie', sql.VarChar(10), datosComprobante.cuie)
        .input('marca', sql.VarChar(10), datosComprobante.marca)
        .query(query);

    return result && result.recordset ? result.recordset[0].id : null;
}

export async function mapeoNomenclador(codigoNomenclador, pool) {
    let query = 'SELECT * FROM [dbo].[PN_nomenclador] where id_nomenclador = @codigo';
    let resultado = await new sql.Request(pool)
        .input('codigo', sql.VarChar(50), codigoNomenclador)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;
}

export async function mapeoEfector(codigoCUIE, pool) {
    let query = 'SELECT * FROM dbo.Sys_efector WHERE cuie = @codigo';
    let resultado = await new sql.Request(pool)
        .input('codigo', sql.VarChar(50), codigoCUIE)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;;
}


export async function getAfiliadoSumar(documento, pool) {
    let query = "SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @documento AND activo = 'S'";
    let resultado = await new sql.Request(pool)
        .input('documento', sql.VarChar(50), documento)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;;
}
