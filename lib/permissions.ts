export type AppRole = "user" | "admin";
export type AppPermission =
  | "recipes.manage_own"
  | "recipes.request_publication"
  | "imports.manage_own"
  | "backup.export_own"
  | "backup.restore_merge_own"
  | "backup.restore_replace_own"
  | "admin.review_publications"
  | "admin.review_feedback"
  | "admin.diagnostics";

const rolePermissions:Record<AppRole,ReadonlySet<AppPermission>>={
  user:new Set([
    "recipes.manage_own",
    "recipes.request_publication",
    "imports.manage_own",
    "backup.export_own",
    "backup.restore_merge_own",
  ]),
  admin:new Set([
    "recipes.manage_own",
    "recipes.request_publication",
    "imports.manage_own",
    "backup.export_own",
    "backup.restore_merge_own",
    "backup.restore_replace_own",
    "admin.review_publications",
    "admin.review_feedback",
    "admin.diagnostics",
  ]),
};

export function hasPermission(role:AppRole,permission:AppPermission){
  return rolePermissions[role].has(permission);
}

export const roleLabel:Record<AppRole,string>={user:"普通用户",admin:"管理员"};
