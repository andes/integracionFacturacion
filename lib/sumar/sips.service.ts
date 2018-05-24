// import * as sql from 'mssql';
import * as http from 'http';
import { SipsDBConfiguration } from '../../config.private';
const sql = require('mssql');

export async function mapeoPaciente(pool, dni) {
    console.log('mapeoPaciente')
    let query = 'SELECT TOP 1 * FROM dbo.Sys_Paciente where activo=1 and numeroDocumento=@dni order by objectId DESC;';
    let result = await new sql.Request(pool)
        .input('dni', sql.VarChar(50), dni)
        .query(query);

    return result.recordset[0] ? result.recordset[0] : null;
}

export async function insertBeneficiario(pool, pacienteSips, efector) {
    console.log('insertBeneficiario')
    return;
}

export async function saveComprobanteSumar(pool, datosComprobante) {
    console.log('------------saveComprobanteSumar------------------')
    let query = "INSERT INTO dbo.PN_comprobante ( cuie, id_factura, nombre_medico, fecha_comprobante, clavebeneficiario, id_smiafiliados, " +
        " fecha_carga, comentario, marca, periodo, activo, idTipoDePrestacion) " +
        "values (@cuie," + null + "," + null + ",'" + datosComprobante.fechaComprobante + "'," + "'" + datosComprobante.claveBeneficiario + "'" +
        "," + datosComprobante.idAfiliado + ",'" + datosComprobante.fechaCarga + "','" + datosComprobante.comentario + "', @marca,'" +
        datosComprobante.periodo + "','" + datosComprobante.activo + "'," + datosComprobante.idTipoPrestacion + ")" +
        ' SELECT SCOPE_IDENTITY() AS id';

    let result = await new sql.Request(pool)
        .input('cuie', sql.VarChar(10), datosComprobante.cuie)
        .input('marca', sql.VarChar(10), datosComprobante.marca)
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

    return resultado.recordset[0] ? resultado.recordset[0] : null;;
}


export async function getAfiliadoSumar(pool, documento) {
    let query = "SELECT * FROM dbo.PN_smiafiliados WHERE afidni = @documento AND activo = 'S'";
    let resultado = await new sql.Request(pool)
        .input('documento', sql.VarChar(50), documento)
        .query(query);

    return resultado.recordset[0] ? resultado.recordset[0] : null;;
}

export async function insertPrestaciones(pool, prestacion) {

    let query = 'INSERT INTO [dbo].[PN_prestacion] ([id_comprobante],[id_nomenclador],[cantidad],[precio_prestacion],[id_anexo],[diagnostico],[edad],[sexo],[codigo_comp]' +
        // ',[fecha_nacimiento],[fecha_prestacion],[anio],[mes],[dia]' + 
        ')' +
        ' VALUES (@idComprobante,@idNomenclador,@cantidad,@precioPrestacion,@idAnexo,@diagnostico,@edad,@sexo,@codigoComp' +
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
        //    .input('peso', sql.Decimal, peso)
        //    .input('tensionArterial', sql.VarChar(7), tensionArterial)
        .input('diagnostico', sql.VarChar(500), prestacion.diagnostico)
        .input('edad', sql.VarChar(2), prestacion.edad)
        .input('sexo', sql.VarChar(2), prestacion.sexo)
        .input('codigoComp', sql.VarChar(100), prestacion.codigo)
        // .input('fechaNacimiento', sql.DateTime, prestacion.fechaNacimiento)
        // .input('fechaPrestacion', sql.DateTime, prestacion.fechaPrestacion)
        // .input('anio', sql.Int, prestacion.anio)
        // .input('mes', sql.Int, prestacion.mes)
        // .input('dia', sql.Int, prestacion.dia)

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