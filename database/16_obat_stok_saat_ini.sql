-- =====================================================================
-- 16_obat_stok_saat_ini.sql
-- Tambahkan kolom stok_saat_ini (INT NOT NULL DEFAULT 0) pada tabel
-- master dbo.[Obat] serta sinkronkan nilai awalnya dari akumulasi
-- dbo.[Stok_Batch] yang sudah tercatat.
-- =====================================================================
USE MiniWorldRS;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('dbo.Obat', 'stok_saat_ini') IS NULL
BEGIN
    ALTER TABLE dbo.[Obat]
        ADD [stok_saat_ini] INT NOT NULL
        CONSTRAINT [DF_Obat_stok_saat_ini] DEFAULT (0);
END
GO

-- Sinkronkan stok_saat_ini untuk data obat eksisting berdasarkan Stok_Batch bila masih 0
UPDATE o
   SET o.[stok_saat_ini] = ISNULL(agg.total_batch, 0)
  FROM dbo.[Obat] o
  OUTER APPLY (
      SELECT CAST(ISNULL(SUM(sb.jumlah), 0) AS INT) AS total_batch
        FROM dbo.[Batch_Obat] bo
        JOIN dbo.[Stok_Batch] sb ON sb.batch_id = bo.batch_id
       WHERE bo.obat_id = o.obat_id
  ) agg
 WHERE o.[stok_saat_ini] = 0
   AND ISNULL(agg.total_batch, 0) > 0;
GO

-- Pastikan seluruh trigger audit memiliki guard terhadap operasi 0-baris
DECLARE @def NVARCHAR(MAX), @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT OBJECT_DEFINITION(t.object_id)
    FROM sys.triggers t
   WHERE t.name LIKE 'trg_audit[_]%'
     AND t.name <> 'trg_audit_logs_immutable'
     AND t.is_disabled = 0;

OPEN cur;
FETCH NEXT FROM cur INTO @def;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @def NOT LIKE '%IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;%'
  BEGIN
    SET @sql = REPLACE(@def, 'SET NOCOUNT ON;',
      'SET NOCOUNT ON;' + CHAR(13) + CHAR(10) +
      '    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;');
    SET @sql = STUFF(@sql, 1, CHARINDEX('TRIGGER', @sql) - 1, 'ALTER ');
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @def;
END
CLOSE cur;
DEALLOCATE cur;
GO
