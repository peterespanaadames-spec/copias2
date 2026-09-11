const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// 1. Fix OrderTimer block
const badOrderTimer = `      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-[#131921] uppercase tracking-tight">
                {editingUserId ? 'Editar Usuario' : 'Agregar Usuario'}
              </h2>
              <button 
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre</label>
                  <input
                    type="text"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={userFormEmail}
                    onChange={(e) => setUserFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                    placeholder="Ej. juan@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Rol</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Despachador">Despachador</option>
                    <option value="Repartidor">Repartidor</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50/80">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-bold tracking-wide transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStoreUser}
                disabled={!userFormName || !userFormEmail || !userFormRole}
                className="px-5 py-2 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-black rounded-lg transition shadow-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
;`;

code = code.replace(badOrderTimer, `    </div>\n  );\n};`);

// 2. Insert User Modal at the bottom of AdminPanel component before final </div>\n  );\n}
const userModalJSX = `
      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-[#131921] uppercase tracking-tight">
                {editingUserId ? 'Editar Usuario' : 'Agregar Usuario'}
              </h2>
              <button 
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre</label>
                  <input
                    type="text"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={userFormEmail}
                    onChange={(e) => setUserFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                    placeholder="Ej. juan@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Rol</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#008296] focus:border-transparent"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Despachador">Despachador</option>
                    <option value="Repartidor">Repartidor</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50/80">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-bold tracking-wide transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStoreUser}
                disabled={!userFormName || !userFormEmail || !userFormRole}
                className="px-5 py-2 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-black rounded-lg transition shadow-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

code = code.replace(/    <\/div>\n  \);\n}$/, userModalJSX);

// 3. Fix activeRole comparison types
code = code.replace("if (activeRole !== 'Admin' && activeRole !== 'Gerente')", "if ((activeRole as string) !== 'Admin' && (activeRole as string) !== 'Gerente' && activeRole !== 'admin')");
code = code.replaceAll("(activeRole === 'Admin' || activeRole === 'Gerente')", "((activeRole as string) === 'Admin' || (activeRole as string) === 'Gerente' || activeRole === 'admin')");

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log("Successfully fixed AdminPanel.tsx");
