import * as request from "request";
import { IncomingWebhook, IncomingWebhookResult } from "@slack/webhook";
import * as yargs from "yargs";

const argv = yargs
  .option("SLACK_WEBHOOK_URL", {
    demandOption: true,
    describe: "Slack webhook URL",
    type: "string",
  })
  .option("TEAMWORK_API_KEY", {
    demandOption: true,
    describe: "Teamwork API key",
    type: "string",
  })
  .help()
  .alias("help", "h").argv;

// Set up Slack webhook
// const slackWebhookUrl: string = process.env.SLACK_WEBHOOK_URL!;
const slackWebhookUrl: string = argv.SLACK_WEBHOOK_URL!;
const slackWebhook: IncomingWebhook = new IncomingWebhook(slackWebhookUrl);

// Set up Teamwork API credentials
// const teamworkApiKey: string = process.env.TEAMWORK_API_KEY!;
const teamworkApiKey: string = argv.TEAMWORK_API_KEY!;

interface Task {
  id: string;
  content: string;
}
interface TaskProjectName extends Task {
  projectName: string;
}

// Make API call to Teamwork API to retrieve list of unassigned tasks
const getUnassignedTasks = (): Promise<Task[]> => {
  const requestOptions = {
    url: "https://jaladesign.teamwork.com/tasks.json",
    auth: {
      user: teamworkApiKey,
      pass: "",
      sendImmediately: true,
    },
    qs: {
      completed: false
    },
    json: true,
  };

  return new Promise((resolve, reject) => {
    request.get(requestOptions, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        // Filter list of tasks to only include unassigned tasks
        const unassignedTasks: Task[] = body["todo-items"].filter(
          (task: Task) => !task["responsible-party-id"]
        );

        resolve(unassignedTasks);
      }
    });
  });
};

// Make API call to Teamwork API to retrieve project name for a task
const getProjectName = (taskId: string): Promise<string> => {
  const requestOptions = {
    url: `https://jaladesign.teamwork.com/tasks/${taskId}.json`,
    auth: {
      user: teamworkApiKey,
      pass: "",
      sendImmediately: true,
    },
    json: true,
  };

  return new Promise((resolve, reject) => {
    request.get(requestOptions, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve(body["todo-item"]["project-name"]);
      }
    });
  });
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
    let message: string = "List of unassigned tasks:\n";
    tasksWithProjectName.forEach((task: TaskProjectName) => {
      message += `• Project: ${task.projectName} - ${task.content} \n`;
    });

    // Send message to Slack
    const result: IncomingWebhookResult = await slackWebhook.send(message);
    console.log("Message sent to Slack");
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Call main function
sendUnassignedTasksToSlack();
