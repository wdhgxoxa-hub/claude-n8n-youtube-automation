/* Diagnóstico exclusivo del SQLite ficticio del ensayo; no lee filas ni cambia PRAGMAs. */
#include <sqlite3ext.h>
SQLITE_EXTENSION_INIT1
#include <stdio.h>
static void memoria(sqlite3_context *ctx, int argc, sqlite3_value **argv) {
  (void)argc; (void)argv;
  sqlite3 *db=sqlite3_context_db_handle(ctx);
  int sentencias=0, cache=0, esquema=0, maximo=0;
  if (sqlite3_db_status(db,SQLITE_DBSTATUS_STMT_USED,&sentencias,&maximo,0)!=SQLITE_OK ||
      sqlite3_db_status(db,SQLITE_DBSTATUS_CACHE_USED,&cache,&maximo,0)!=SQLITE_OK ||
      sqlite3_db_status(db,SQLITE_DBSTATUS_SCHEMA_USED,&esquema,&maximo,0)!=SQLITE_OK) {
    sqlite3_result_error(ctx,"Diagnostico SQLite no disponible",-1); return;
  }
  char salida[256];
  snprintf(salida,sizeof(salida),"{\"heapSqliteBytes\":%lld,\"sentenciasBytes\":%d,\"cacheBytes\":%d,\"esquemaBytes\":%d}",
    (long long)sqlite3_memory_used(),sentencias,cache,esquema);
  sqlite3_result_text(ctx,salida,-1,SQLITE_TRANSIENT);
}
#ifdef _WIN32
__declspec(dllexport)
#endif
int sqlite3_extension_init(sqlite3 *db, char **error, const sqlite3_api_routines *api) {
  (void)error; SQLITE_EXTENSION_INIT2(api);
  return sqlite3_create_function(db,"cooper_memoria_sqlite",0,SQLITE_UTF8,NULL,memoria,NULL,NULL);
}
