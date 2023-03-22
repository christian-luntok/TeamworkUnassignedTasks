import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook';
import * as yargs from 'yargs';

const argv = yargs
	.option('SLACK_WEBHOOK_URL', {
		demandOption: true,
		describe: 'Slack webhook URL',
		type: 'string',
	})
	.option('TEAMWORK_API_KEY', {
		demandOption: true,
		describe: 'Teamwork API key',
		type: 'string',
	})
	.help()
	.alias('help', 'h').argv;

// Set up Slack webhook
// const slackWebhookUrl: string = process.env.SLACK_WEBHOOK_URL!;
const slackWebhookUrl: string = argv.SLACK_WEBHOOK_URL!;
const slackWebhook: IncomingWebhook = new IncomingWebhook(slackWebhookUrl);

// Set up Teamwork API credentials
// const teamworkApiKey: string = process.env.TEAMWORK_API_KEY!;
const teamworkApiKey: string = argv.TEAMWORK_API_KEY!;

type TaskProjectName = {
	projectName: string;
	id: string;
	content: string;
};

type Task = {
	id: string;
	content: string;
};

// Make API call to Teamwork API to retrieve list of unassigned tasks
const getUnassignedTasks = async (): Promise<Task[]> => {
	const response = await fetch('https://jaladesign.teamwork.com/tasks.json', {
		headers: { Authorization: teamworkApiKey },
	});

	if (!response.ok) {
		throw Error('Could not get task list');
	}

	const taskList = await response.json();
	return taskList['todo-items'].filter((task: Task) => !task['responsible-party-id']);
};

// Make API call to Teamwork API to retrieve project name for a task
const getProjectName = async (taskId: string): Promise<string> => {
	const response = await fetch(`https://jaladesign.teamwork.com/tasks/${taskId}.json`, {
		headers: { Authorization: teamworkApiKey },
	});

	if (!response.ok) {
		throw Error('Could not get task list');
	}

	const task = await response.json();
	return task['todo-item']['project-name'];
};

// Main function that retrieves list of unassigned tasks and sends a message to Slack
const sendUnassignedTasksToSlack = async (): Promise<IncomingWebhookResult> => {
	try {
		// Retrieve list of unassigned tasks
		const unassignedTasks: Task[] = await getUnassignedTasks();

		// Get project name for each task
		const tasksWithProjectName: TaskProjectName[] = await Promise.all(
			unassignedTasks.map(async (task: Task) => {
				const projectName: string = await getProjectName(task.id);
				return { ...task, projectName };
			})
		);

		// Format message
		let message: string = 'List of unassigned tasks:\n';
		tasksWithProjectName.forEach((task: TaskProjectName) => {
			message += `• Project: ${task.projectName} - ${task.content} \n`;
		});

		// Send message to Slack
		const result: IncomingWebhookResult = await slackWebhook.send(message);
		console.log('Message sent to Slack');
		return result;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

// Call main function
sendUnassignedTasksToSlack();
