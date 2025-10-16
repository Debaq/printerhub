<?php
/**
 * PrinterHub - Instalador Manual
 * Este script puede ejecutarse manualmente para reinstalar/actualizar la base de datos
 * URL: /api/install.php
 */

// Solo permitir ejecución si la BD no existe o si se pasa el parámetro force=1
$forceReinstall = isset($_GET['force']) && $_GET['force'] === '1';

define('DB_PATH', __DIR__ . '/../data/printerhub.db');
define('SCHEMA_PATH', __DIR__ . '/schema.sql');

$dbExists = file_exists(DB_PATH);

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PrinterHub - Instalador</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 32px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        .status {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.warning { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .icon { font-size: 24px; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 16px;
            transition: all 0.3s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-box h3 {
            margin-bottom: 10px;
            color: #333;
        }
        .info-box ul {
            margin-left: 20px;
            color: #666;
        }
        .info-box li {
            margin: 5px 0;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖨️ PrinterHub</h1>
        <p class="subtitle">Sistema de Gestión de Impresoras 3D</p>

        <?php if ($dbExists && !$forceReinstall): ?>
            
            <div class="status success">
                <span class="icon">✅</span>
                <div>
                    <strong>Base de datos encontrada</strong><br>
                    La instalación ya está completa
                </div>
            </div>

            <div class="info-box">
                <h3>Estado del Sistema</h3>
                <ul>
                    <li>Base de datos: <code><?php echo DB_PATH; ?></code></li>
                    <li>Tamaño: <?php echo round(filesize(DB_PATH) / 1024, 2); ?> KB</li>
                    <li>Última modificación: <?php echo date('Y-m-d H:i:s', filemtime(DB_PATH)); ?></li>
                </ul>
            </div>

            <div class="status info">
                <span class="icon">ℹ️</span>
                <div>
                    <strong>Usuario admin por defecto:</strong><br>
                    Usuario: <code>admin</code><br>
                    Contraseña: <code>admin123</code><br>
                    <small>⚠️ Recuerda cambiar la contraseña después del primer login</small>
                </div>
            </div>

            <div class="actions">
                <a href="../" class="btn btn-primary">Ir a la Aplicación</a>
                <a href="?force=1" class="btn btn-danger" onclick="return confirm('¿Estás seguro? Esto eliminará todos los datos existentes.')">Reinstalar BD</a>
            </div>

        <?php else: ?>

            <?php
            // Proceder con la instalación
            $error = null;
            $success = false;

            try {
                // Crear directorio data si no existe
                $dataDir = dirname(DB_PATH);
                if (!is_dir($dataDir)) {
                    mkdir($dataDir, 0777, true);
                }

                // Crear directorio uploads
                $uploadsDir = dirname(DB_PATH) . '/uploads';
                if (!is_dir($uploadsDir)) {
                    mkdir($uploadsDir, 0777, true);
                }

                // Eliminar BD existente si force=1
                if ($forceReinstall && file_exists(DB_PATH)) {
                    unlink(DB_PATH);
                }

                // Crear conexión
                $db = new PDO('sqlite:' . DB_PATH);
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

                // Ejecutar schema
                if (file_exists(SCHEMA_PATH)) {
                    $sql = file_get_contents(SCHEMA_PATH);
                    $db->exec($sql);
                } else {
                    throw new Exception('Archivo schema.sql no encontrado');
                }

                $success = true;

            } catch (Exception $e) {
                $error = $e->getMessage();
            }
            ?>

            <?php if ($success): ?>

                <div class="status success">
                    <span class="icon">🎉</span>
                    <div>
                        <strong>¡Instalación completada!</strong><br>
                        La base de datos se ha creado exitosamente
                    </div>
                </div>

                <div class="info-box">
                    <h3>Credenciales de Administrador</h3>
                    <ul>
                        <li>Usuario: <code>admin</code></li>
                        <li>Contraseña: <code>admin123</code></li>
                        <li>Email: <code>admin@printerhub.local</code></li>
                    </ul>
                </div>

                <div class="status warning">
                    <span class="icon">⚠️</span>
                    <div>
                        <strong>Importante:</strong><br>
                        Cambia la contraseña del usuario admin inmediatamente después del primer login
                    </div>
                </div>

                <div class="info-box">
                    <h3>Próximos Pasos</h3>
                    <ul>
                        <li>Ingresa con las credenciales de admin</li>
                        <li>Cambia la contraseña por defecto</li>
                        <li>Crea usuarios adicionales</li>
                        <li>Agrega tus impresoras</li>
                        <li>Configura permisos según necesites</li>
                    </ul>
                </div>

                <div class="actions">
                    <a href="../" class="btn btn-primary">Ir a la Aplicación</a>
                </div>

            <?php else: ?>

                <div class="status error">
                    <span class="icon">❌</span>
                    <div>
                        <strong>Error en la instalación</strong><br>
                        <?php echo htmlspecialchars($error); ?>
                    </div>
                </div>

                <div class="info-box">
                    <h3>Soluciones posibles:</h3>
                    <ul>
                        <li>Verifica que el directorio <code>/data/</code> tenga permisos de escritura</li>
                        <li>Asegúrate que PHP tenga la extensión SQLite habilitada</li>
                        <li>Revisa los logs del servidor para más detalles</li>
                    </ul>
                </div>

                <div class="actions">
                    <a href="?" class="btn btn-primary">Reintentar</a>
                </div>

            <?php endif; ?>

        <?php endif; ?>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
            PrinterHub v1.0 - Sistema de gestión de impresoras 3D
        </div>
    </div>
</body>
</html>
