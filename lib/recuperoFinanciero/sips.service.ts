// import * as sql from 'mssql';
import * as http from 'http';
import { SipsDBConfiguration } from '../../config.private';
const sql = require('mssql');


export async function getTipoNomenclador(pool, idObraSocial, fecha) {
    let query = 'SELECT isnull( C.idTipoNomenclador, 0 ) as idTipoNomenclador FROM dbo.FAC_ContratoObraSocial C ' +
    ' INNER JOIN dbo.FAC_TipoNomenclador TN ON C.idTipoNomenclador = TN.idTipoNomenclador ' +
    ' WHERE C.idObraSocial = @idObraSocial ' +
    ' AND TN.fechaDesde <= @fecha ' +
    ' AND fechaHasta >= @fecha ';
    let result = await new sql.Request(pool)
        .input('idObraSocial', sql.Int, idObraSocial)
        .input('fecha', sql.DateTime, fecha)
        .query(query);
    return result.recordset[0] ? result.recordset[0].idTipoNomenclador : 0;
}

export async function mapeoNomenclador(pool, codigo, idTipoNomenclador) {
    let query = 'SELECT TOP 1 * FROM dbo.FAC_Nomenclador WHERE codigo = @codigo and idTipoNomenclador = @idTipoNomenclador;';
    let result = await new sql.Request(pool)
        .input('codigo', sql.VarChar(50), codigo)
        .input('idTipoNomenclador', sql.Int, idTipoNomenclador)
        .query(query);
    return result.recordset[0];
}

export async function guardarOrden(pool, orden) {
    let query = 'INSERT INTO [dbo].[FAC_Orden]' +
                    ' ([idEfector]' +
                    ' ,[numero]' +
                    ' ,[periodo]' +
                    ' ,[idServicio]' +
                    ' ,[idPaciente]' +
                    ' ,[idProfesional]' +
                    ' ,[fecha]' +
                    ' ,[fechaPractica]' +
                    ' ,[idTipoPractica]' +
                    ' ,[idObraSocial]' +
                    ' ,[nroAfiliado]' +
                    ' ,[observaciones]' +
                    ' ,[estado]' +
                    ' ,[idUsuarioRegistro]' +
                    ' ,[fechaRegistro]' +
                    ' ,[idPrefactura]' +
                    ' ,[idFactura]' +
                    ' ,[baja]' +
                    ' ,[codificaHIV]' +
                    ' ,[monto]' +
                    ' ,[numeroSiniestro]' +
                    ' ,[fechaSiniestro]' +
                    ' ,[facturaFueraConvenio] ' +
                    ' ,[esInternacion])' +
                ' VALUES' +
                    ' (@idEfector' +
                    ' ,@numero' +
                    ' ,@periodo' +
                    ' ,@idServicio' +
                    ' ,@idPaciente' +
                    ' ,@idProfesional' +
                    ' ,@fecha' +
                    ' ,@fechaPractica' +
                    ' ,@idTipoPractica' +
                    ' ,@idObraSocial' +
                    ' ,@nroAfiliado' +
                    ' ,@observaciones' +
                    ' ,@estado' +
                    ' ,@idUsuarioRegistro' +
                    ' ,@fechaRegistro' +
                    ' ,@idPrefactura' +
                    ' ,@idFactura' +
                    ' ,@baja' +
                    ' ,@codificaHIV' +
                    ' ,@monto' +
                    ' ,@numeroSiniestro' +
                    ' ,@fechaSiniestro' +
                    ' ,@facturaFueraConvenio ' +
                    ' ,@esInternacion) ' +
                'DECLARE @numeroOrden Int =  SCOPE_IDENTITY() ' +
                'UPDATE FAC_Orden SET numero = @numeroOrden WHERE idOrden = @numeroOrden ' +
                'SELECT @numeroOrden as ID';
    
    let result = await new sql.Request(pool)
        .input('idEfector', sql.Int, orden.idEfector)
        .input('numero', sql.Int, orden.numero)
        .input('periodo', sql.Char(10) , orden.periodo)
        .input('idServicio', sql.Int, orden.idServicio)
        .input('idPaciente', sql.Int, orden.idPaciente) 
        .input('idProfesional', sql.Int, orden.idProfesional)
        .input('fecha', sql.DateTime, orden.fecha)
        .input('fechaPractica', sql.DateTime, orden.fechaPractica)
        .input('idTipoPractica', sql.Int, orden.idTipoPractica)
        .input('idObraSocial', sql.Int, orden.idObraSocial)
        .input('nroAfiliado', sql.VarChar(50), orden.nroAfiliado)
        .input('observaciones',  sql.VarChar(500), orden.observaciones)
        .input('estado', sql.Char(10), orden.estado)
        .input('idUsuarioRegistro', sql.Int, orden.idUsuarioRegistro)
        .input('fechaRegistro', sql.DateTime, orden.fechaRegistro)
        .input('idPrefactura', sql.Int, orden.idPrefactura)
        .input('idFactura', sql.Int, orden.idFactura)
        .input('baja', sql.Bit, orden.baja)
        .input('codificaHIV', sql.Bit, orden.codificaHIV)
        .input('monto', sql.Decimal(18, 2), orden.monto)
        .input('numeroSiniestro', sql.VarChar(50), orden.numeroSiniestro)
        .input('fechaSiniestro', sql.DateTime, orden.fechaSiniestro)
        .input('facturaFueraConvenio', sql.Bit, orden.facturaFueraConvenio)
        .input('esInternacion', sql.Bit, orden.esInternacion)
        .query(query);

        return result.recordset[0] ? result.recordset[0].ID : null;
}

export async function guardarOrdenDetalle(pool, ordenDetalle) {
    let query = 'INSERT INTO [dbo].[FAC_OrdenDetalle]' +
                ' ([idOrden]' +
                ' ,[idEfector]' +
                ' ,[idNomenclador]' +
                ' ,[descripcion]' +
                ' ,[cantidad]' +
                ' ,[valorUnidad]' +
                ' ,[ajuste])' +
            ' VALUES' +
                ' (@idOrden' +
                ' ,@idEfector' +
                ' ,@idNomenclador' +
                ' ,@descripcion' +
                ' ,@cantidad' +
                ' ,@valorUnidad' +
                ' ,@ajuste) ' +
            'SELECT SCOPE_IDENTITY() as ID';

    let result = await new sql.Request(pool)
        .input('idOrden', sql.Int, ordenDetalle.idOrden)
        .input('idEfector', sql.Int, ordenDetalle.idEfector)
        .input('idNomenclador', sql.Int, ordenDetalle.idNomenclador)
        .input('descripcion', sql.VarChar(500) , ordenDetalle.descripcion)
        .input('cantidad', sql.Int, ordenDetalle.cantidad)
        .input('valorUnidad', sql.Decimal(18, 2), ordenDetalle.valorUnidad)
        .input('ajuste', sql.Decimal(18, 2), ordenDetalle.ajuste)
        .query(query);

        return result.recordset[0];
}
    
    