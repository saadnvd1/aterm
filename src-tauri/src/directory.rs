use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    is_git_repo: bool,
}

// Entry for project file explorer (uses relative paths)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileEntry {
    name: String,
    path: String,     // Relative path from project root
    is_dir: bool,
}

// Directories to always filter out in project explorer
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".turbo",
    ".vercel",
    "target",      // Rust/Cargo
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "venv",
    ".venv",
    "env",
    ".tox",
    "coverage",
    ".coverage",
    ".nyc_output",
    ".cache",
    ".parcel-cache",
    ".svelte-kit",
    ".output",
];

#[tauri::command]
pub fn list_directory(path: Option<String>) -> Result<Vec<DirEntry>, String> {
    let dir_path = path
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from("/")));

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') && name != ".." {
            continue;
        }

        let is_dir = path.is_dir();
        let is_git_repo = is_dir && path.join(".git").exists();

        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            is_git_repo,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn get_home_dir() -> String {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/"))
        .to_string_lossy()
        .to_string()
}

/// List directory contents for project file explorer
/// Returns entries with paths relative to the project root
#[tauri::command]
pub fn list_project_directory(
    root: String,
    relative_path: Option<String>,
) -> Result<Vec<ProjectFileEntry>, String> {
    let root_path = PathBuf::from(&root);
    let full_path = match &relative_path {
        Some(rel) if !rel.is_empty() => root_path.join(rel),
        _ => root_path.clone(),
    };

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&full_path).map_err(|e| e.to_string())?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files (except specific ones we want to show)
        if name.starts_with('.') && !is_important_dotfile(&name) {
            continue;
        }

        let is_dir = path.is_dir();

        // Skip ignored directories
        if is_dir && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }

        // Calculate relative path from root
        let rel_path = match &relative_path {
            Some(rel) if !rel.is_empty() => format!("{}/{}", rel, name),
            _ => name.clone(),
        };

        entries.push(ProjectFileEntry {
            name,
            path: rel_path,
            is_dir,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Check if a dotfile is important enough to show
fn is_important_dotfile(name: &str) -> bool {
    matches!(
        name,
        ".env"
            | ".env.local"
            | ".env.development"
            | ".env.production"
            | ".gitignore"
            | ".npmrc"
            | ".nvmrc"
            | ".prettierrc"
            | ".prettierrc.json"
            | ".prettierrc.js"
            | ".eslintrc"
            | ".eslintrc.json"
            | ".eslintrc.js"
            | ".editorconfig"
            | ".dockerignore"
    )
}

/// Read type definition files from node_modules for Monaco TypeScript support
#[tauri::command]
pub fn read_type_definitions(root: String) -> Result<Vec<TypeDefinition>, String> {
    let root_path = PathBuf::from(&root);
    let mut definitions = Vec::new();

    // Key packages to load types from
    let type_packages = [
        ("@types/react", "node_modules/@types/react"),
        ("@types/react-dom", "node_modules/@types/react-dom"),
        ("typescript/lib", "node_modules/typescript/lib"),
    ];

    for (package_name, rel_path) in type_packages {
        let package_path = root_path.join(rel_path);
        if package_path.exists() {
            collect_dts_files(&package_path, package_name, &mut definitions);
        }
    }

    // Also try to load from the project's own types
    let types_dir = root_path.join("src/types");
    if types_dir.exists() {
        collect_dts_files(&types_dir, "src/types", &mut definitions);
    }

    // Load root-level .d.ts files from src/ (e.g., vite-env.d.ts)
    let src_dir = root_path.join("src");
    if src_dir.exists() {
        if let Ok(entries) = fs::read_dir(&src_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".d.ts") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        definitions.push(TypeDefinition {
                            path: format!("src/{}", name),
                            content,
                        });
                    }
                }
            }
        }
    }

    Ok(definitions)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeDefinition {
    pub path: String,      // Virtual path for Monaco (e.g., "node_modules/@types/react/index.d.ts")
    pub content: String,   // The actual type definition content
}

fn collect_dts_files(dir: &PathBuf, base_name: &str, definitions: &mut Vec<TypeDefinition>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                // Recurse into subdirectories (but skip node_modules within packages)
                if name != "node_modules" {
                    let sub_base = format!("{}/{}", base_name, name);
                    collect_dts_files(&path, &sub_base, definitions);
                }
            } else if name.ends_with(".d.ts") {
                // Read the type definition file
                if let Ok(content) = fs::read_to_string(&path) {
                    let virtual_path = format!("node_modules/{}/{}", base_name, name);
                    definitions.push(TypeDefinition {
                        path: virtual_path,
                        content,
                    });
                }
            }
        }
    }
}

/// Recursively list all files in a project (for file search)
#[tauri::command]
pub fn list_all_project_files(root: String) -> Result<Vec<String>, String> {
    let root_path = PathBuf::from(&root);
    let mut files = Vec::new();
    collect_files_recursive(&root_path, &root_path, &mut files)?;
    Ok(files)
}

fn collect_files_recursive(
    root: &PathBuf,
    current: &PathBuf,
    files: &mut Vec<String>,
) -> Result<(), String> {
    let read_dir = fs::read_dir(current).map_err(|e| e.to_string())?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files (except important dotfiles)
        if name.starts_with('.') && !is_important_dotfile(&name) {
            continue;
        }

        let is_dir = path.is_dir();

        // Skip ignored directories
        if is_dir && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }

        if is_dir {
            // Recurse into directory
            collect_files_recursive(root, &path, files)?;
        } else {
            // Add file with relative path
            if let Ok(rel_path) = path.strip_prefix(root) {
                files.push(rel_path.to_string_lossy().to_string());
            }
        }
    }

    Ok(())
}
