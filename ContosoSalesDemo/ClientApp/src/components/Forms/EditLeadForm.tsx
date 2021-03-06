// ---------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ---------------------------------------------------------------------------

import './Forms.scss';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import { NavTabs } from '../NavTabs/NavTabs';
import { InputBox } from '../InputBox';
import { Icon } from '../Icon/Icon';
import {
	editLeadPopupTabNames,
	entityNameLeads,
	entityNameOpportunities,
	entityNameActivities,
	formInputErrorMessage,
	ratingOptionsSet,
	sourceOptionsSet,
	activityTypeOptions,
	leadStatus,
	activityPriorityOptions,
	opportunityStatus,
	opportunitySalesStage,
} from '../../constants';
import { setPreFilledValues, getFormattedDate, trimInput, removeWrappingBraces } from '../utils';
import { saveCDSData, CDSAddRequest, CDSUpdateAddRequest, CDSUpdateRequest } from './SaveData';
import ThemeContext from '../../themeContext';
import {
	EditLeadFormData,
	Activity,
	Lead,
	Opportunity,
	Tab,
	FormProps,
	DateFormat,
	CDSAddRequestData,
	CDSUpdateRequestData,
	CDSUpdateAddRequestData,
	LeadTablePowerBIData,
	PreFilledValues,
} from '../../models';
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner';

interface EditLeadFormProps extends FormProps {
	preFilledValues?: PreFilledValues;
}

export function EditLeadForm(props: EditLeadFormProps): JSX.Element {
	const theme = useContext(ThemeContext);
	const errorIconDimension = 30;
	const [dueDate, setDueDate] = useState({
		dueDate: new Date(),
	});

	const [estimateCloseDate, setEstimateCloseDate] = useState({
		estimateCloseDate: new Date(),
	});

	// List of tabs' name
	const tabNames: Array<Tab['name']> = editLeadPopupTabNames;

	// State hook to set first tab as active
	const [activeTab, setActiveTab] = useState<Tab['name']>(() => {
		if (tabNames?.length > 0) {
			return tabNames[0];
		} else {
			return null;
		}
	});

	// Create array of Tab for rendering and set isActive as true for the active tab
	const tabsDetails: Array<Tab> = tabNames.map(
		(tabName: Tab['name']): Tab => {
			return { name: tabName, isActive: tabName === activeTab };
		}
	);

	// Lead table visual fields in embedded report
	const leadTableFields: LeadTablePowerBIData = {
		LeadId: { name: 'Lead Id', value: null },
		BaseId: { name: 'crcb2_baseid', value: null },
		AccountId: { name: 'Account Id', value: null },
		AccountName: { name: 'Account Name', value: null },
		ContactName: { name: 'Contact Name', value: null },
		Topic: { name: 'Topic', value: null },
		Status: { name: 'Status', value: null },
		Rating: { name: 'Rating', value: null },
		Source: { name: 'Source', value: null },
		CreatedOn: { name: 'Created on', value: null },
	};

	// Set values from report's table visual
	setPreFilledValues(props.preFilledValues, leadTableFields);

	const { register, handleSubmit, errors } = useForm();
	const addActivityFormOnSubmit = async (formData: Activity) => {
		props.toggleWritebackProgressState();
		const formattedDueDate = getFormattedDate(dueDate.dueDate, DateFormat.YearMonthDayTime);
		formData.crcb2_duedatetime = formattedDueDate;
		formData.crcb2_startdatetime = formattedDueDate;
		formData.crcb2_enddatetime = formattedDueDate;
		formData.crcb2_topic = leadTableFields.Topic.value;
		delete formData['activityaccountname'];
		delete formData['activitycontactfullname'];

		// Remove '{' and '}' from the id captured from report table visual
		formData['crcb2_LeadId@odata.bind'] = `leads(${removeWrappingBraces(leadTableFields.LeadId.value)})`;

		// Build request
		const addRequestData: CDSAddRequestData = {
			newData: JSON.stringify(formData),
			addEntityType: entityNameActivities,
		};
		const addRequest = new CDSAddRequest(addRequestData);
		const result = await saveCDSData(addRequest, props.updateApp, props.setError);
		if (result) {
			props.refreshReport();
			props.toggleFormPopup();
		}
		props.toggleWritebackProgressState();
	};
	const qualifyLeadFormOnSubmit = async (formData: EditLeadFormData) => {
		props.toggleWritebackProgressState();
		const leadData: Lead = {
			crcb2_primarycontactname: leadTableFields.ContactName.value,
			subject: leadTableFields.Topic.value,
			crcb2_leadstatus: leadStatus['Qualified'],
			leadqualitycode: ratingOptionsSet[leadTableFields.Rating.value],
			leadsourcecode: sourceOptionsSet[leadTableFields.Source.value],
		};

		// Remove '{' and '}' from the id captured from report table visual
		leadData['parentaccountid@odata.bind'] = `accounts(${removeWrappingBraces(
			leadTableFields.AccountId.value
		)})`;
		const opportunityData: Opportunity = {
			name: leadTableFields.Topic.value,
			crcb2_quoteamount: formData.estimatedrevenue,
			estimatedclosedate: getFormattedDate(
				estimateCloseDate.estimateCloseDate,
				DateFormat.YearMonthDay
			),
			estimatedvalue: formData.estimatedrevenue,
			crcb2_salesstage: opportunitySalesStage['Propose'],
			crcb2_opportunitystatus:
				opportunityStatus[opportunityStatus.findIndex((option) => (option.value = 'New'))].code,
		};

		// Remove '{' and '}' from the id captured from report table visual
		opportunityData['originatingleadid@odata.bind'] = `leads(${removeWrappingBraces(
			leadTableFields.LeadId.value
		)})`;

		// Build request
		const updateRequestData: CDSUpdateRequestData = {
			baseId: leadTableFields.BaseId.value ?? leadTableFields.LeadId.value,
			updatedData: JSON.stringify(leadData),
			updateEntityType: entityNameLeads,
		};
		const addRequestData: CDSAddRequestData = {
			newData: JSON.stringify(opportunityData),
			addEntityType: entityNameOpportunities,
		};
		const updateAddRequestData: CDSUpdateAddRequestData = {
			UpdateReqBody: updateRequestData,
			AddReqBody: addRequestData,
		};
		const requestObject = new CDSUpdateAddRequest(updateAddRequestData);
		const result = await saveCDSData(requestObject, props.updateApp, props.setError);
		if (result) {
			props.refreshReport();
			props.toggleFormPopup();
		}
		props.toggleWritebackProgressState();
	};
	const disqualifyLeadFormOnSubmit = async () => {
		props.toggleWritebackProgressState();
		const leadData: Lead = {
			crcb2_leadstatus: leadStatus['Disqualified'],
			crcb2_primarycontactname: leadTableFields.ContactName.value,
			leadqualitycode: ratingOptionsSet[leadTableFields.Rating.value],
			leadsourcecode: sourceOptionsSet[leadTableFields.Source.value],
			subject: leadTableFields.Topic.value,
		};

		// Remove '{' and '}' from the id captured from report table visual
		leadData['parentaccountid@odata.bind'] = `accounts(${removeWrappingBraces(
			leadTableFields.AccountId.value
		)})`;

		// Build request
		const updateRequestData: CDSUpdateRequestData = {
			baseId: leadTableFields.BaseId.value ?? leadTableFields.LeadId.value,
			updatedData: JSON.stringify(leadData),
			updateEntityType: entityNameLeads,
		};
		const updateRequest = new CDSUpdateRequest(updateRequestData);
		const result = await saveCDSData(updateRequest, props.updateApp, props.setError);
		if (result) {
			props.refreshReport();
			props.toggleFormPopup();
		}
		props.toggleWritebackProgressState();
	};

	const navTabs = <NavTabs tabsList={tabsDetails} tabOnClick={setActiveTab} />;

	const addActivityInputBoxesBeforeSelect = [
		{
			title: 'Account Name',
			name: 'activityaccountname',
			className: 'form-control form-element',

			// Show '--blank--' where applicable if empty field is fetched from the report
			placeHolder: '--blank--',
			value: leadTableFields.AccountName.value,
			ref: register,
		},
		{
			title: 'Contact Full Name',
			name: 'activitycontactfullname',
			className: 'form-control form-element',
			placeHolder: '--blank--',
			value: leadTableFields.ContactName.value,
			ref: register,
		},
		{
			title: 'Topic',
			name: 'crcb2_topic',
			className: 'form-control form-element',
			placeHolder: '--blank--',
			value: leadTableFields.Topic.value,
			ref: register,
		},
	];

	const addActivityInputListBeforeSelect = addActivityInputBoxesBeforeSelect.map((input) => {
		return (
			<InputBox
				onBlur={(event) => trimInput(event)}
				title={input.title}
				name={input.name}
				className={input.className}
				placeHolder={input.placeHolder}
				value={input.value}
				disabled={true}
				// Grab value from form element
				ref={input.ref}
				key={input.name}
			/>
		);
	});

	const subjectBox = (
		<InputBox
			onBlur={(event) => trimInput(event)}
			title='Subject'
			name='crcb2_subject'
			required={true}
			className={`form-control form-element ${errors.crcb2_subject && `is-invalid`}`}
			placeHolder={`e.g., '100 Laptops'`}
			errorMessage={formInputErrorMessage}
			// Grab value from form element
			ref={register({ required: true, minLength: 1 })}
		/>
	);

	const descriptionBox = (
		<InputBox
			onBlur={(event) => trimInput(event)}
			title='Description'
			name='crcb2_description'
			required={true}
			className={`form-control form-element ${errors.crcb2_description && `is-invalid`}`}
			placeHolder='Enter Description'
			errorMessage={formInputErrorMessage}
			// Grab value from form element
			ref={register({ required: true, minLength: 1 })}
		/>
	);

	let formActionElement: JSX.Element = <LoadingSpinner />;
	if (!props.isWritebackInProgress) {
		formActionElement = (
			<div className='d-flex justify-content-center btn-form-submit'>
				<button className='btn btn-form' type='submit'>
					Add Activity
				</button>
			</div>
		);
	}
	const addActivityForm = (
		<form
			className={`d-flex flex-column justify-content-between popup-form ${theme}`}
			noValidate
			onSubmit={handleSubmit(addActivityFormOnSubmit)}>
			<div className='form-content'>
				{addActivityInputListBeforeSelect}

				<div>
					<label className='input-label required'>Activity Type</label>
					<select
						className={`form-control form-element ${
							errors.crcb2_activitytype && `is-invalid`
						} ${theme}`}
						name='crcb2_activitytype'
						defaultValue=''
						// Grab value from form element
						ref={register({ required: true })}>
						<option className={`select-list ${theme}`} value='' disabled={true}>
							Select
						</option>
						{Object.keys(activityTypeOptions).map((option) => {
							return (
								<option
									className={`select-list ${theme}`}
									value={activityTypeOptions[option]}
									key={activityTypeOptions[option]}>
									{option}
								</option>
							);
						})}
					</select>
					<div className='invalid-feedback'>{formInputErrorMessage}</div>
				</div>

				{subjectBox}

				<div>
					<label className='input-label required'>Priority</label>
					<select
						className={`form-control form-element ${
							errors.crcb2_priority && `is-invalid`
						} ${theme}`}
						name='crcb2_priority'
						defaultValue=''
						// Grab value from form element
						ref={register({ required: true })}>
						<option className={`select-list ${theme}`} value='' disabled={true}>
							Select
						</option>
						{Object.keys(activityPriorityOptions).map((option) => {
							return (
								<option
									className={`select-list ${theme}`}
									value={activityPriorityOptions[option]}
									key={activityPriorityOptions[option]}>
									{option}
								</option>
							);
						})}
					</select>
					<div className='invalid-feedback'>{formInputErrorMessage}</div>
				</div>

				{descriptionBox}

				<div>
					<label className='input-label required'>Due Date</label>
					<div className='date-container'>
						<DatePicker
							className={`form-control form-element date-picker ${theme}`}
							name='crcb2_duedatetime'
							selected={dueDate.dueDate}
							value={getFormattedDate(dueDate.dueDate, DateFormat.DayMonthDayYear)}
							onChange={(date: Date) => setDueDate({ dueDate: date })}
							ref={register({ required: true })}
						/>
					</div>
				</div>
			</div>
			{formActionElement}
		</form>
	);

	const qualifyLeadInputBoxes = [
		{
			title: 'Account Name',
			name: 'leadaccountname',
			className: 'form-control form-element',
			placeHolder: '--blank--',
			errorMessage: formInputErrorMessage,
			value: leadTableFields.AccountName.value,
			disabled: true,
			ref: register,
		},
		{
			title: 'Contact Full Name',
			name: 'leadcontactfullname',
			className: 'form-control form-element',
			placeHolder: '--blank--',
			value: leadTableFields.ContactName.value,
			disabled: true,
			ref: register,
		},
		{
			title: 'Topic',
			name: 'leadtopic',
			className: 'form-control form-element',
			placeHolder: '--blank--',
			value: leadTableFields.Topic.value,
			disabled: true,
			ref: register,
		},
		{
			title: 'Estimated Revenue',
			name: 'estimatedrevenue',
			required: true,
			className: `form-control form-element ${errors.estimatedrevenue && `is-invalid`}`,
			placeHolder: `e.g. '10000' (in $)`,
			errorMessage: formInputErrorMessage,
			ref: register({ required: true, minLength: 1 }),
		},
	];

	const qualifyLeadInputList = qualifyLeadInputBoxes.map((input) => {
		return (
			<InputBox
				onBlur={(event) => trimInput(event)}
				title={input.title}
				name={input.name}
				required={input.required}
				className={input.className}
				placeHolder={input.placeHolder}
				errorMessage={input.errorMessage}
				value={input.value}
				disabled={input.disabled}
				ref={input.ref}
				key={input.name}
			/>
		);
	});

	if (!props.isWritebackInProgress) {
		formActionElement = (
			<div className='d-flex justify-content-center btn-form-submit'>
				<button className='btn btn-form' type='submit'>
					Qualify Lead
				</button>
			</div>
		);
	}
	const qualifyLeadForm = (
		<form
			className={`d-flex flex-column justify-content-between popup-form ${theme}`}
			noValidate
			onSubmit={handleSubmit(qualifyLeadFormOnSubmit)}>
			<div className='form-content'>
				{qualifyLeadInputList}
				<div>
					<label className='input-label required'>Estimated Close Date</label>
					<div className='date-container'>
						<DatePicker
							className={`form-control form-element date-picker ${theme}`}
							name='estimatedclosedate'
							selected={estimateCloseDate.estimateCloseDate}
							value={getFormattedDate(
								estimateCloseDate.estimateCloseDate,
								DateFormat.DayMonthDayYear
							)}
							onChange={(date: Date) => setEstimateCloseDate({ estimateCloseDate: date })}
							ref={register({ required: true })}
						/>
					</div>
				</div>
			</div>
			{formActionElement}
		</form>
	);

	if (!props.isWritebackInProgress) {
		formActionElement = (
			<div className='d-flex justify-content-center btn-form-submit'>
				<button className='btn btn-form' type='submit'>
					Disqualify Lead
				</button>
			</div>
		);
	}
	const disqualifyLeadForm = (
		<form
			className={`d-flex flex-column justify-content-between popup-form ${theme}`}
			noValidate
			onSubmit={handleSubmit(disqualifyLeadFormOnSubmit)}>
			<div className='form-content'>
				<div className={`d-flex flex-row warning ${theme}`}>
					<Icon
						className='warning-icon'
						iconId={`error-${theme}`}
						height={errorIconDimension}
						width={errorIconDimension}
					/>
					<div className='warning-message'>Are you sure you want to disqualify this lead?</div>
				</div>
			</div>
			{formActionElement}
		</form>
	);

	return (
		<div className={`d-flex flex-column align-items-center overlay ${theme}`}>
			<div className={`popup ${theme}`}>
				<div className={`d-flex justify-content-between popup-header ${theme}`}>
					<div className='tab-container'>{navTabs}</div>
					<button
						type='button'
						className={`close close-button tabbed-form-close-button p-0 ${theme}`}
						aria-label='Close'
						onClick={props.toggleFormPopup}>
						<span aria-hidden='true'>&times;</span>
					</button>
				</div>
				{activeTab === tabNames[0]
					? addActivityForm
					: activeTab === tabNames[1]
					? qualifyLeadForm
					: activeTab === tabNames[2]
					? disqualifyLeadForm
					: null}
			</div>
		</div>
	);
}
