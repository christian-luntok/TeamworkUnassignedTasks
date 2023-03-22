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
const SLACK_WEBHOOK_URL: string = argv.SLACK_WEBHOOK_URL!;
const SLACK_WEBHOOK: IncomingWebhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

// Set up Teamwork API credentials
// const teamworkApiKey: string = process.env.TEAMWORK_API_KEY!;
const TEAMWORK_API_KEY: string = argv.TEAMWORK_API_KEY!;

type Task = {
  projectName?: string;
	id: string;
	content: string;
};

// Make API call to Teamwork API to retrieve list of unassigned tasks
async function getUnassignedTasks (): Promise<Task[]> {
	const response = await fetch('https://jaladesign.teamwork.com/tasks.json', {
		headers: { Authorization: TEAMWORK_API_KEY },
	});

	if (!response.ok) {
		throw Error('Could not get task list');
	}

	const taskList = await response.json();
	return taskList['todo-items'].filter((task: Task) => !task['responsible-party-id']);
};

// Make API call to Teamwork API to retrieve project name for a task
async function getProjectName (taskId: string): Promise<string> {
	const response = await fetch(`https://jaladesign.teamwork.com/tasks/${taskId}.json`, {
		headers: { Authorization: TEAMWORK_API_KEY },
	});

	if (!response.ok) {
		throw Error('Could not get task');
	}

	const task = await response.json();
	return task['todo-item']['project-name'];
};

// Main function that retrieves list of unassigned tasks and sends a message to Slack
async function sendUnassignedTasksToSlack (): Promise<IncomingWebhookResult> {
	try {
		// Retrieve list of unassigned tasks
		const unassignedTasks: Task[] = await getUnassignedTasks();

		// Get project name for each task
		const tasksWithProjectName: Task[] = await Promise.all(
			unassignedTasks.map(async (task: Task) => {
				const projectName: string = await getProjectName(task.id);
				return { ...task, projectName };
			})
		);

    const message = formatTasks(tasksWithProjectName)

		// Send message to Slack
		const result: IncomingWebhookResult = await SLACK_WEBHOOK.send(message);
		console.log('Message sent to Slack');
		return result;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

function formatTasks(tasks: Task[]) {
  // Format message
  let message: string = 'List of unassigned tasks:\n';
  tasks.forEach((task: Task) => {
    message += `• Project: ${task.projectName} - ${task.content} \n`;
  });
  return message
}


// Call main function
sendUnassignedTasksToSlack();
