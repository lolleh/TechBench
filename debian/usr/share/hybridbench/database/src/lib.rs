use rusqlite::{Connection, params, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use log::{info, error};

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Database not initialized")]
    NotInitialized,
}

pub type Result<T> = std::result::Result<T, DatabaseError>;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub project_type: String,
    pub status: String,
    pub customer_name: Option<String>,
    pub customer_contact: Option<String>,
    pub device_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub tags: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub chipset: Option<String>,
    pub cpu: Option<String>,
    pub storage_type: Option<String>,
    pub storage_capacity: Option<String>,
    pub ram: Option<String>,
    pub android_version: Option<String>,
    pub ios_version: Option<String>,
    pub imei: Option<String>,
    pub serial_number: Option<String>,
    pub boot_mode: Option<String>,
    pub bootloader_locked: bool,
    pub security_state: Option<String>,
    pub battery_health: Option<String>,
    pub last_seen: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Repair {
    pub id: String,
    pub project_id: String,
    pub device_id: String,
    pub repair_type: String,
    pub status: String,
    pub priority: String,
    pub title: String,
    pub description: Option<String>,
    pub diagnosis: Option<String>,
    pub solution: Option<String>,
    pub parts_used: String,
    pub tools_used: String,
    pub time_spent_minutes: i32,
    pub cost_parts: f64,
    pub cost_labor: f64,
    pub cost_total: f64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub technician: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Component {
    pub id: String,
    pub name: String,
    pub category: String,
    pub manufacturer: Option<String>,
    pub part_number: Option<String>,
    pub description: Option<String>,
    pub package: Option<String>,
    pub common_devices: String,
    pub common_faults: String,
    pub test_points: String,
    pub datasheet_url: Option<String>,
    pub price_range: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BootSignature {
    pub id: String,
    pub name: String,
    pub chipset: Option<String>,
    pub manufacturer: Option<String>,
    pub pattern_description: String,
    pub status: String,
    pub diagnosis: Option<String>,
    pub suggestion: Option<String>,
    pub avg_current_a: Option<f64>,
    pub peak_current_a: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub usage_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PowerLogEntry {
    pub id: String,
    pub project_id: String,
    pub device_id: Option<String>,
    pub session_name: Option<String>,
    pub voltage: f64,
    pub current: f64,
    pub power: f64,
    pub temperature: Option<f64>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestResult {
    pub id: String,
    pub repair_id: String,
    pub test_type: String,
    pub test_name: String,
    pub result: String,
    pub expected_value: Option<String>,
    pub actual_value: Option<String>,
    pub unit: Option<String>,
    pub notes: Option<String>,
    pub timestamp: String,
}

impl Database {
    pub fn new(db_path: &PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        
        let db = Self {
            conn: Mutex::new(conn),
        };
        
        db.initialize_schema()?;
        info!("Database initialized at {:?}", db_path);
        
        Ok(db)
    }

    fn initialize_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute_batch(include_str!("schema/001_initial.sql"))?;
        
        Ok(())
    }

    pub fn seed_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        let seeds = [
            include_str!("seeds/001_components.sql"),
            include_str!("seeds/002_power_signatures.sql"),
        ];
        
        for seed in &seeds {
            conn.execute_batch(seed)?;
        }
        
        info!("Seed data loaded");
        Ok(())
    }

    // =========================================================================
    // Projects CRUD
    // =========================================================================

    pub fn create_project(&self, name: &str, project_type: &str, description: Option<&str>, customer_name: Option<&str>) -> Result<Project> {
        let conn = self.conn.lock().unwrap();
        let id = generate_id();
        
        conn.execute(
            "INSERT INTO projects (id, name, project_type, description, customer_name) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, project_type, description, customer_name],
        )?;
        
        let project = self.get_project_by_id(&id)?;
        Ok(project.unwrap())
    }

    pub fn get_project_by_id(&self, id: &str) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, project_type, status, customer_name, customer_contact, device_id, created_at, updated_at, completed_at, tags, notes FROM projects WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                project_type: row.get(3)?,
                status: row.get(4)?,
                customer_name: row.get(5)?,
                customer_contact: row.get(6)?,
                device_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                completed_at: row.get(10)?,
                tags: row.get(11)?,
                notes: row.get(12)?,
            })
        })?;
        
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_projects(&self, status_filter: Option<&str>, limit: i64, offset: i64) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        
        let (query, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match status_filter {
            Some(status) => (
                "SELECT id, name, description, project_type, status, customer_name, customer_contact, device_id, created_at, updated_at, completed_at, tags, notes FROM projects WHERE status = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3".to_string(),
                vec![Box::new(status.to_string()), Box::new(limit), Box::new(offset)],
            ),
            None => (
                "SELECT id, name, description, project_type, status, customer_name, customer_contact, device_id, created_at, updated_at, completed_at, tags, notes FROM projects ORDER BY updated_at DESC LIMIT ?1 OFFSET ?2".to_string(),
                vec![Box::new(limit), Box::new(offset)],
            ),
        };
        
        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                project_type: row.get(3)?,
                status: row.get(4)?,
                customer_name: row.get(5)?,
                customer_contact: row.get(6)?,
                device_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                completed_at: row.get(10)?,
                tags: row.get(11)?,
                notes: row.get(12)?,
            })
        })?;
        
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        
        Ok(projects)
    }

    pub fn update_project(&self, id: &str, name: Option<&str>, description: Option<&str>, status: Option<&str>, notes: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        if let Some(n) = name {
            conn.execute("UPDATE projects SET name = ?1, updated_at = datetime('now') WHERE id = ?2", params![n, id])?;
        }
        if let Some(d) = description {
            conn.execute("UPDATE projects SET description = ?1, updated_at = datetime('now') WHERE id = ?2", params![d, id])?;
        }
        if let Some(s) = status {
            conn.execute("UPDATE projects SET status = ?1, updated_at = datetime('now') WHERE id = ?2", params![s, id])?;
            if s == "completed" {
                conn.execute("UPDATE projects SET completed_at = datetime('now') WHERE id = ?1", params![id])?;
            }
        }
        if let Some(n) = notes {
            conn.execute("UPDATE projects SET notes = ?1, updated_at = datetime('now') WHERE id = ?2", params![n, id])?;
        }
        
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_projects(&self, query: &str) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, project_type, status, customer_name, customer_contact, device_id, created_at, updated_at, completed_at, tags, notes FROM projects WHERE name LIKE ?1 OR description LIKE ?1 OR customer_name LIKE ?1 OR notes LIKE ?1 ORDER BY updated_at DESC LIMIT 50"
        )?;
        
        let rows = stmt.query_map(params![search_pattern], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                project_type: row.get(3)?,
                status: row.get(4)?,
                customer_name: row.get(5)?,
                customer_contact: row.get(6)?,
                device_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                completed_at: row.get(10)?,
                tags: row.get(11)?,
                notes: row.get(12)?,
            })
        })?;
        
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        
        Ok(projects)
    }

    // =========================================================================
    // Devices CRUD
    // =========================================================================

    pub fn create_device(&self, name: &str, manufacturer: Option<&str>, model: Option<&str>, chipset: Option<&str>) -> Result<Device> {
        let conn = self.conn.lock().unwrap();
        let id = generate_id();
        
        conn.execute(
            "INSERT INTO devices (id, name, manufacturer, model, chipset) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, manufacturer, model, chipset],
        )?;
        
        let device = self.get_device_by_id(&id)?;
        Ok(device.unwrap())
    }

    pub fn get_device_by_id(&self, id: &str) -> Result<Option<Device>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, manufacturer, model, chipset, cpu, storage_type, storage_capacity, ram, android_version, ios_version, imei, serial_number, boot_mode, bootloader_locked, security_state, battery_health, last_seen, created_at, updated_at, tags, notes FROM devices WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Device {
                id: row.get(0)?,
                name: row.get(1)?,
                manufacturer: row.get(2)?,
                model: row.get(3)?,
                chipset: row.get(4)?,
                cpu: row.get(5)?,
                storage_type: row.get(6)?,
                storage_capacity: row.get(7)?,
                ram: row.get(8)?,
                android_version: row.get(9)?,
                ios_version: row.get(10)?,
                imei: row.get(11)?,
                serial_number: row.get(12)?,
                boot_mode: row.get(13)?,
                bootloader_locked: row.get(14)?,
                security_state: row.get(15)?,
                battery_health: row.get(16)?,
                last_seen: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                tags: row.get(20)?,
                notes: row.get(21)?,
            })
        })?;
        
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_devices(&self, limit: i64, offset: i64) -> Result<Vec<Device>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, manufacturer, model, chipset, cpu, storage_type, storage_capacity, ram, android_version, ios_version, imei, serial_number, boot_mode, bootloader_locked, security_state, battery_health, last_seen, created_at, updated_at, tags, notes FROM devices ORDER BY updated_at DESC LIMIT ?1 OFFSET ?2"
        )?;
        
        let rows = stmt.query_map(params![limit, offset], |row| {
            Ok(Device {
                id: row.get(0)?,
                name: row.get(1)?,
                manufacturer: row.get(2)?,
                model: row.get(3)?,
                chipset: row.get(4)?,
                cpu: row.get(5)?,
                storage_type: row.get(6)?,
                storage_capacity: row.get(7)?,
                ram: row.get(8)?,
                android_version: row.get(9)?,
                ios_version: row.get(10)?,
                imei: row.get(11)?,
                serial_number: row.get(12)?,
                boot_mode: row.get(13)?,
                bootloader_locked: row.get(14)?,
                security_state: row.get(15)?,
                battery_health: row.get(16)?,
                last_seen: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                tags: row.get(20)?,
                notes: row.get(21)?,
            })
        })?;
        
        let mut devices = Vec::new();
        for row in rows {
            devices.push(row?);
        }
        
        Ok(devices)
    }

    pub fn update_device(&self, id: &str, fields: &std::collections::HashMap<String, String>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        let allowed_fields = [
            "name", "manufacturer", "model", "chipset", "cpu", "storage_type",
            "storage_capacity", "ram", "android_version", "ios_version", "imei",
            "serial_number", "boot_mode", "bootloader_locked", "security_state",
            "battery_health", "tags", "notes",
        ];
        
        for (key, value) in fields {
            if allowed_fields.contains(&key.as_str()) {
                let sql = format!("UPDATE devices SET {} = ?1, updated_at = datetime('now') WHERE id = ?2", key);
                conn.execute(&sql, params![value, id])?;
            }
        }
        
        Ok(())
    }

    pub fn delete_device(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM devices WHERE id = ?1", params![id])?;
        Ok(())
    }

    // =========================================================================
    // Repairs CRUD
    // =========================================================================

    pub fn create_repair(&self, project_id: &str, device_id: &str, repair_type: &str, title: &str, description: Option<&str>) -> Result<Repair> {
        let conn = self.conn.lock().unwrap();
        let id = generate_id();
        
        conn.execute(
            "INSERT INTO repairs (id, project_id, device_id, repair_type, title, description) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, device_id, repair_type, title, description],
        )?;
        
        let repair = self.get_repair_by_id(&id)?;
        Ok(repair.unwrap())
    }

    pub fn get_repair_by_id(&self, id: &str) -> Result<Option<Repair>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, device_id, repair_type, status, priority, title, description, diagnosis, solution, parts_used, tools_used, time_spent_minutes, cost_parts, cost_labor, cost_total, created_at, updated_at, completed_at, technician FROM repairs WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Repair {
                id: row.get(0)?,
                project_id: row.get(1)?,
                device_id: row.get(2)?,
                repair_type: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                title: row.get(6)?,
                description: row.get(7)?,
                diagnosis: row.get(8)?,
                solution: row.get(9)?,
                parts_used: row.get(10)?,
                tools_used: row.get(11)?,
                time_spent_minutes: row.get(12)?,
                cost_parts: row.get(13)?,
                cost_labor: row.get(14)?,
                cost_total: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
                completed_at: row.get(18)?,
                technician: row.get(19)?,
            })
        })?;
        
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_repairs_for_project(&self, project_id: &str) -> Result<Vec<Repair>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, device_id, repair_type, status, priority, title, description, diagnosis, solution, parts_used, tools_used, time_spent_minutes, cost_parts, cost_labor, cost_total, created_at, updated_at, completed_at, technician FROM repairs WHERE project_id = ?1 ORDER BY created_at DESC"
        )?;
        
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Repair {
                id: row.get(0)?,
                project_id: row.get(1)?,
                device_id: row.get(2)?,
                repair_type: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                title: row.get(6)?,
                description: row.get(7)?,
                diagnosis: row.get(8)?,
                solution: row.get(9)?,
                parts_used: row.get(10)?,
                tools_used: row.get(11)?,
                time_spent_minutes: row.get(12)?,
                cost_parts: row.get(13)?,
                cost_labor: row.get(14)?,
                cost_total: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
                completed_at: row.get(18)?,
                technician: row.get(19)?,
            })
        })?;
        
        let mut repairs = Vec::new();
        for row in rows {
            repairs.push(row?);
        }
        
        Ok(repairs)
    }

    pub fn update_repair_status(&self, id: &str, status: &str, diagnosis: Option<&str>, solution: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "UPDATE repairs SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![status, id],
        )?;
        
        if let Some(d) = diagnosis {
            conn.execute("UPDATE repairs SET diagnosis = ?1 WHERE id = ?2", params![d, id])?;
        }
        if let Some(s) = solution {
            conn.execute("UPDATE repairs SET solution = ?1 WHERE id = ?2", params![s, id])?;
        }
        if status == "completed" {
            conn.execute("UPDATE repairs SET completed_at = datetime('now') WHERE id = ?1", params![id])?;
        }
        
        Ok(())
    }

    // =========================================================================
    // Components
    // =========================================================================

    pub fn search_components(&self, query: &str, category: Option<&str>) -> Result<Vec<Component>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);
        
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match category {
            Some(cat) => (
                "SELECT id, name, category, manufacturer, part_number, description, package, common_devices, common_faults, test_points, datasheet_url, price_range FROM components WHERE (name LIKE ?1 OR part_number LIKE ?1 OR description LIKE ?1) AND category = ?2 LIMIT 50".to_string(),
                vec![Box::new(search_pattern), Box::new(cat.to_string())],
            ),
            None => (
                "SELECT id, name, category, manufacturer, part_number, description, package, common_devices, common_faults, test_points, datasheet_url, price_range FROM components WHERE name LIKE ?1 OR part_number LIKE ?1 OR description LIKE ?1 LIMIT 50".to_string(),
                vec![Box::new(search_pattern)],
            ),
        };
        
        let mut stmt = conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(Component {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                manufacturer: row.get(3)?,
                part_number: row.get(4)?,
                description: row.get(5)?,
                package: row.get(6)?,
                common_devices: row.get(7)?,
                common_faults: row.get(8)?,
                test_points: row.get(9)?,
                datasheet_url: row.get(10)?,
                price_range: row.get(11)?,
            })
        })?;
        
        let mut components = Vec::new();
        for row in rows {
            components.push(row?);
        }
        
        Ok(components)
    }

    // =========================================================================
    // Boot Signatures
    // =========================================================================

    pub fn get_boot_signatures(&self, chipset: Option<&str>) -> Result<Vec<BootSignature>> {
        let conn = self.conn.lock().unwrap();
        
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match chipset {
            Some(cs) => (
                "SELECT id, name, chipset, manufacturer, pattern_description, status, diagnosis, suggestion, avg_current_a, peak_current_a, duration_seconds, usage_count FROM boot_signatures WHERE chipset = ?1".to_string(),
                vec![Box::new(cs.to_string())],
            ),
            None => (
                "SELECT id, name, chipset, manufacturer, pattern_description, status, diagnosis, suggestion, avg_current_a, peak_current_a, duration_seconds, usage_count FROM boot_signatures".to_string(),
                vec![],
            ),
        };
        
        let mut stmt = conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(BootSignature {
                id: row.get(0)?,
                name: row.get(1)?,
                chipset: row.get(2)?,
                manufacturer: row.get(3)?,
                pattern_description: row.get(4)?,
                status: row.get(5)?,
                diagnosis: row.get(6)?,
                suggestion: row.get(7)?,
                avg_current_a: row.get(8)?,
                peak_current_a: row.get(9)?,
                duration_seconds: row.get(10)?,
                usage_count: row.get(11)?,
            })
        })?;
        
        let mut signatures = Vec::new();
        for row in rows {
            signatures.push(row?);
        }
        
        Ok(signatures)
    }

    // =========================================================================
    // Power Logs
    // =========================================================================

    pub fn insert_power_log(&self, project_id: &str, device_id: Option<&str>, session_name: Option<&str>, voltage: f64, current: f64, temperature: Option<f64>) -> Result<String> {
        let conn = self.conn.lock().unwrap();
        let id = generate_id();
        let power = voltage * current;
        
        conn.execute(
            "INSERT INTO power_logs (id, project_id, device_id, session_name, voltage, current, power, temperature) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, project_id, device_id, session_name, voltage, current, power, temperature],
        )?;
        
        Ok(id)
    }

    pub fn get_power_logs(&self, project_id: &str, limit: i64) -> Result<Vec<PowerLogEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, device_id, session_name, voltage, current, power, temperature, timestamp FROM power_logs WHERE project_id = ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;
        
        let rows = stmt.query_map(params![project_id, limit], |row| {
            Ok(PowerLogEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                device_id: row.get(2)?,
                session_name: row.get(3)?,
                voltage: row.get(4)?,
                current: row.get(5)?,
                power: row.get(6)?,
                temperature: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?;
        
        let mut logs = Vec::new();
        for row in rows {
            logs.push(row?);
        }
        
        Ok(logs)
    }

    // =========================================================================
    // Audit Log
    // =========================================================================

    pub fn log_audit(&self, action: &str, entity_type: &str, entity_id: Option<&str>, details: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
            params![action, entity_type, entity_id, details],
        )?;
        
        Ok(())
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    pub fn get_stats(&self) -> Result<serde_json::Value> {
        let conn = self.conn.lock().unwrap();
        
        let project_count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
        let active_projects: i64 = conn.query_row("SELECT COUNT(*) FROM projects WHERE status = 'active'", [], |row| row.get(0))?;
        let device_count: i64 = conn.query_row("SELECT COUNT(*) FROM devices", [], |row| row.get(0))?;
        let repair_count: i64 = conn.query_row("SELECT COUNT(*) FROM repairs", [], |row| row.get(0))?;
        let completed_repairs: i64 = conn.query_row("SELECT COUNT(*) FROM repairs WHERE status = 'completed'", [], |row| row.get(0))?;
        let component_count: i64 = conn.query_row("SELECT COUNT(*) FROM components", [], |row| row.get(0))?;
        
        Ok(serde_json::json!({
            "projects": {
                "total": project_count,
                "active": active_projects,
            },
            "devices": {
                "total": device_count,
            },
            "repairs": {
                "total": repair_count,
                "completed": completed_repairs,
            },
            "components": {
                "total": component_count,
            },
        }))
    }
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", timestamp)
}
