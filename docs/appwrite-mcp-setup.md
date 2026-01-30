# Configurar MCP de Appwrite para migraciones

El MCP (Model Context Protocol) de Appwrite permite que el agente de Cursor cree y gestione la base de datos y colecciones en Appwrite directamente desde el chat.

## Requisitos

1. **uv** (para ejecutar el MCP de Appwrite):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
   Comprueba con: `uv --version`

2. **API Key de Appwrite** con permisos de **Databases** (lectura y escritura):
   - En [Appwrite Console](https://cloud.appwrite.io) → tu proyecto → **Settings** → **API Keys**
   - Crea una clave y activa el scope **Databases**

## Configuración en Cursor

### Opción A: Usar el MCP del proyecto (recomendado)

El proyecto ya incluye `.cursor/mcp.json` con el endpoint y project ID de tu proyecto. Solo tienes que poner tu API key:

1. Abre **Reconfiguracion-Financiera/.cursor/mcp.json**
2. Sustituye `REPLACE_WITH_YOUR_API_KEY` por tu API key de Appwrite
3. (Opcional) Si quieres evitar guardar la key en el archivo, en Cursor **Settings** → **MCP** añade el servidor manualmente y en **env** usa tu variable de entorno `APPWRITE_API_KEY` si Cursor la soporta)

4. Reinicia Cursor o recarga la ventana para que cargue el MCP

### Opción B: Añadir el MCP desde Cursor Settings

1. Abre **Cursor Settings** (Cmd/Ctrl + ,)
2. Ve a la pestaña **MCP** (o **Features** → **MCP**)
3. Pulsa **Add new global MCP server** (o **+ Add New MCP Server**)
4. Pega esta configuración (cambia la API key):

```json
{
  "mcpServers": {
    "appwrite-api": {
      "command": "uvx",
      "args": ["mcp-server-appwrite", "--databases"],
      "env": {
        "APPWRITE_ENDPOINT": "https://nyc.cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID": "697cf77a0038f25cd6e6",
        "APPWRITE_API_KEY": "tu-api-key-aqui"
      }
    }
  }
}
```

## Hacer las migraciones con el MCP

Una vez el MCP esté configurado y activo:

1. Abre el **Agent** o **Composer** en Cursor
2. Pide al agente que ejecute las migraciones usando el MCP de Appwrite, por ejemplo:
   - *"Crea en Appwrite la base de datos finaria y todas las colecciones del esquema según docs/appwrite-schema.md usando el MCP de Appwrite"*
   - *"Usa el MCP de Appwrite para crear la base de datos y las colecciones organizations, profiles, org_members, etc."*

El agente usará las herramientas del MCP (crear base de datos, crear colección, crear atributos) para replicar el esquema.

## Argumentos del MCP (opcional)

Por defecto el servidor tiene habilitado **Databases** (API legacy). Puedes añadir más APIs en `args`:

| Argumento    | Descripción        |
|-------------|--------------------|
| `--databases` | API legacy Databases (crear DB, colecciones, atributos) — **ya incluido** |
| `--tables-db` | API TablesDB (nueva) |
| `--users`     | Users API          |
| `--storage`   | Storage API        |
| `--functions` | Functions API      |
| `--all`       | Todas las APIs     |

Para migraciones solo hace falta `--databases`.
