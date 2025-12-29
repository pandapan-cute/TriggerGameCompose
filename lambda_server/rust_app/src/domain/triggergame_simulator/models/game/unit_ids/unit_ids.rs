use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct UnitIds {
    value: Vec<String>,
}

impl UnitIds {
    pub fn new(value: Vec<String>) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &Vec<String> {
        &self.value
    }

    fn validate(value: &[String]) {
        for unit_id in value {
            if unit_id.is_empty() {
                panic!("UnitIdsに空文字が含まれています");
            }
            if Uuid::parse_str(unit_id).is_err() {
                panic!("UnitIdsがUUID形式ではありません: {}", unit_id);
            }
        }
    }
}

impl PartialEq for UnitIds {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for UnitIds {}
