#[derive(Debug, Clone)]
pub struct Position {
    x: i32,
    y: i32,
}

impl Position {
    pub fn new(x: i32, y: i32) -> Self {
        Self::validate(x, y);
        Self { x, y }
    }

    pub fn x(&self) -> i32 {
        self.x
    }

    pub fn y(&self) -> i32 {
        self.y
    }

    // バリデーションの実装
    fn validate(x: i32, y: i32) {
        if x < 0 {
            panic!("Position xは0以上である必要があります");
        }
        if y < 0 {
            panic!("Position yは0以上である必要があります");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for Position {
    fn eq(&self, other: &Self) -> bool {
        self.x == other.x && self.y == other.y
    }
}

impl Eq for Position {}
