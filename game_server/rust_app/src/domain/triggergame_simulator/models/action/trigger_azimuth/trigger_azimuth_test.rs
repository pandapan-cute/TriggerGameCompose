#[cfg(test)]
mod tests {
	use super::super::trigger_azimuth::TriggerAzimuth;

	#[test]
	fn test_min_value() {
		let trigger_azimuth = TriggerAzimuth::new(0);
		assert_eq!(trigger_azimuth.value(), 0);
	}

	#[test]
	fn test_max_value() {
		let trigger_azimuth = TriggerAzimuth::new(359);
		assert_eq!(trigger_azimuth.value(), 359);
	}

	#[test]
	fn test_middle_value() {
		let trigger_azimuth = TriggerAzimuth::new(180);
		assert_eq!(trigger_azimuth.value(), 180);
	}

	#[test]
	#[should_panic(expected = "TriggerAzimuthは0以上である必要があります")]
	fn test_below_min() {
		TriggerAzimuth::new(-1);
	}

	#[test]
	#[should_panic(expected = "TriggerAzimuthは359以下である必要があります")]
	fn test_above_max() {
		TriggerAzimuth::new(360);
	}
}
