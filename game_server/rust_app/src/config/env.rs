#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppEnv {
    Local,
    Dev,
    Stg,
    Prod,
}

impl AppEnv {
    pub fn from_env() -> Result<Self, String> {
        // 環境変数を読み取る
        if let Ok(v) = std::env::var("APP_ENV") {
            return match v.to_lowercase().as_str() {
                "local" => Ok(Self::Local),
                "dev" => Ok(Self::Dev),
                "stg" | "stage" => Ok(Self::Stg),
                "prd" | "prod" | "production" => Ok(Self::Prod),
                other => Err(format!("invalid APP_ENV: {}", other)),
            };
        }
        Err("APP_ENVが定義されていません".to_string())
    }

    pub fn is_local(self) -> bool {
        self == Self::Local
    }
    pub fn is_prod(self) -> bool {
        self == Self::Prod
    }
}

pub fn resolve_env_suffix() -> String {
    match AppEnv::from_env() {
        Ok(AppEnv::Dev) => "dev".to_string(),
        Ok(AppEnv::Stg) => "stg".to_string(),
        Ok(AppEnv::Prod) => "prd".to_string(),
        Ok(AppEnv::Local) | Err(_) => "".to_string(),
    }
}

pub fn resolve_table_name(base_name: &str) -> String {
    let suffix = resolve_env_suffix();
    if suffix.is_empty() {
        base_name.to_string()
    } else {
        format!("{}-{}", base_name, suffix)
    }
}
