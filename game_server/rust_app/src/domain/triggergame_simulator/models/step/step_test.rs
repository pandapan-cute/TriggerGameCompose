#[cfg(test)]
mod tests {
    use super::super::step::Step;
    use super::super::step_id::step_id::StepId;
    use super::super::step_type::step_type::{StepType, StepTypeValue};
    use uuid::Uuid;

    #[test]
    fn test_create_step() {
        let step_type = StepType::new(StepTypeValue::Move);
        let step = Step::create(step_type);

        assert!(step.is_move());
        assert!(!step.is_attack());
    }

    #[test]
    fn test_create_attack_step() {
        let step_type = StepType::new(StepTypeValue::Attack);
        let step = Step::create(step_type);

        assert!(step.is_attack());
        assert!(!step.is_move());
    }

    #[test]
    fn test_change_step_type() {
        let step_type = StepType::new(StepTypeValue::Move);
        let mut step = Step::create(step_type);

        assert!(step.is_move());

        let new_step_type = StepType::new(StepTypeValue::Attack);
        step.change_step_type(new_step_type);

        assert!(step.is_attack());
        assert!(!step.is_move());
    }

    #[test]
    fn test_all_step_types() {
        let move_step = Step::create(StepType::new(StepTypeValue::Move));
        assert!(move_step.is_move());

        let attack_step = Step::create(StepType::new(StepTypeValue::Attack));
        assert!(attack_step.is_attack());

        let wait_step = Step::create(StepType::new(StepTypeValue::Wait));
        assert!(wait_step.is_wait());

        let guard_step = Step::create(StepType::new(StepTypeValue::Guard));
        assert!(guard_step.is_guard());

        let unique_step = Step::create(StepType::new(StepTypeValue::UniqueCommand));
        assert!(unique_step.is_unique_command());

        let pursuit_step = Step::create(StepType::new(StepTypeValue::PursuitMove));
        assert!(pursuit_step.is_pursuit_move());
    }

    #[test]
    fn test_reconstruct_step() {
        let step_id = StepId::new(Uuid::new_v4().to_string());
        let step_type = StepType::new(StepTypeValue::Guard);

        let step = Step::reconstruct(step_id.clone(), step_type);

        assert_eq!(step.step_id(), &step_id);
        assert!(step.is_guard());
    }

    #[test]
    fn test_step_equality() {
        let step_id = StepId::new(Uuid::new_v4().to_string());
        let step_type = StepType::new(StepTypeValue::Move);

        let step1 = Step::reconstruct(step_id.clone(), step_type.clone());
        let step2 = Step::reconstruct(step_id.clone(), step_type);

        assert_eq!(step1, step2);
    }
}
