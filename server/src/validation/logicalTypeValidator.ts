import { Validator, ValidationMessage, ValidationMessageAggregator } from './validators';
import { Tree, ObjectNode, KeyValuePair } from '../syntaxTree';
import { CorrectSchemaWalker } from './correctSchemaWalker';
import { StringToken, IntegerToken } from '../tokens';
import { stringify } from 'querystring';
import { HighlightRange } from '../highlightsRange';

export class LogicalTypeValidator implements Validator {
	private typeForLogicalType: Map<string, string[]> = new Map([
		['"decimal"', ['"bytes"', '"fixed"']],
		['"uuid"', ['"string"']],
		['"date"', ['"int"']],
		['"time-millis"', ['"int"']],
		['"time-micros"', ['"long"']],
		['"timestamp-millis"', ['"long"']],
		['"timestamp-micros"', ['"long"']],
		['"local-timestamp-millis"', ['"long"']],
		['"local-timestamp-micros"', ['"long"']],
		['"duration"', ['"fixed"']]
	]);

	validate(tree: Tree): ValidationMessage[] {
		const messageAggregator = new ValidationMessageAggregator();
		const walker = new CorrectSchemaWalker((node, isField, _) => {
			this.validateNode(node, messageAggregator);
		});
		walker.walkTree(tree);
		return messageAggregator.getAll();
	}

	private validateNode(node: ObjectNode, messageAggregator: ValidationMessageAggregator) {
		const logicalTypeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"logicalType"');
		if (logicalTypeAttribute instanceof KeyValuePair) {
			if (!(logicalTypeAttribute.value instanceof StringToken)) {
				messageAggregator.addError(logicalTypeAttribute, 'Logical type attribute has to be a string');
				return;
			}

			const logicalTypeName = logicalTypeAttribute.value.value;
			const expectedType = this.typeForLogicalType.get(logicalTypeName);
			if (expectedType !== undefined) {
				const typeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"type"');
				if (typeAttribute instanceof KeyValuePair) {
					let isValid = false;
					if (typeAttribute.value instanceof StringToken) {
						const typeName = typeAttribute.value.value;
						expectedType.forEach(t => {
							if (typeName === t) {
								isValid = true;
								return;
							}
						})
					}
					if (!isValid) {
						messageAggregator.addError(logicalTypeAttribute, 'Logical type ' + logicalTypeName + ' requires type ' + expectedType.join(' or '));
					}
				}
			}
			else {
				messageAggregator.addError(logicalTypeAttribute, 'Logical type ' + logicalTypeName + ' is unknown');
			}
		}
		this.validateAdditionalAttributes(node, messageAggregator);
	}

	private validateAdditionalAttributes(node: ObjectNode, messageAggregator: ValidationMessageAggregator) {
		const logicalTypeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"logicalType"');
		if (logicalTypeAttribute instanceof KeyValuePair) {
			if (logicalTypeAttribute.value instanceof StringToken) {
				const logicalTypeName = logicalTypeAttribute.value.value;
				if (logicalTypeName === '"duration"') {
					const sizeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"size"');
					if (!(sizeAttribute instanceof KeyValuePair)
						|| !(sizeAttribute.value instanceof IntegerToken)
						|| sizeAttribute.value.value !== '12') {
							messageAggregator.addError(sizeAttribute ?? logicalTypeAttribute, 'Logical type "duration" requires size 12');
					}
				}
				else if (logicalTypeName === '"decimal"') {
					const typeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"type"');
					if (typeAttribute instanceof KeyValuePair) {
						if (typeAttribute.value instanceof StringToken) {
							if (typeAttribute.value.value === '"fixed"') {
								this.validateDecimal(node, logicalTypeAttribute, '"size"', messageAggregator);
							}
							else if (typeAttribute.value.value === '"bytes"') {
								this.validateDecimal(node, logicalTypeAttribute, '"precision"', messageAggregator);
							}
						}
					}

					
				}
			}
		}
	}

	// private validateDecimalFixed(node: ObjectNode, range: HighlightRange, messageAggregator: ValidationMessageAggregator) {
	// 	const sizeAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"size"');
	// 	if (!(sizeAttribute instanceof KeyValuePair) || !(sizeAttribute.value instanceof IntegerToken)) {
	// 		messageAggregator.addError(sizeAttribute ?? range, 'Logical type "decimal" requires size');
	// 		return;
	// 	}
	// 	else {

	// 	}
	// }

	// private validateDecimalBytes(node: ObjectNode, range: HighlightRange, messageAggregator: ValidationMessageAggregator) {
	// 	const precisionAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === '"precision"');
	// 	if (!(precisionAttribute instanceof KeyValuePair) || !(precisionAttribute.value instanceof IntegerToken)) {
	// 		messageAggregator.addError(precisionAttribute ?? range, 'Logical type "decimal" requires precision');
	// 		return;
	// 	}
	// 	else {

	// 	}
	// }

	private validateDecimal(node: ObjectNode, logicalTypeAttribute: HighlightRange, precisionName: string, messageAggregator: ValidationMessageAggregator) {
		const precisionAttribute = node.attributes.find(kv => kv.key !== null && kv.key.value === precisionName);
		const addPrecisionError = function () {
			messageAggregator.addError(precisionAttribute ?? logicalTypeAttribute, 'Logical type "decimal" requires ' + precisionName + ' greater than 0');
		}
		
		if (!(precisionAttribute instanceof KeyValuePair) || !(precisionAttribute.value instanceof IntegerToken)) {
			addPrecisionError();
			return;
		}
		else {
			const precision = Number(precisionAttribute.value.value);
			if (precision <= 0) {
				addPrecisionError();
			}
		}
	}
}