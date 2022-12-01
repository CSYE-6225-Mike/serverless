const AWS = require("aws-sdk");

const checkIfEmailSentAlready = async(
    dynamoDbClient,
    emailTrackingDynamoDBTable,
    userEmail
) => {
    const params = {
        TableName: emailTrackingDynamoDBTable,
        Key: {
            email: userEmail,
        },
    };
    const data = await dynamoDbClient.get(params).promise();
    console.log("Data:", data);
    if (data.Item) {
        return true;
    } else {
        return false;
    }
};
const logEmailSentToDynamoDB = async(
    dynamoDbClient,
    emailTrackingDynamoDBTable,
    userEmail
) => {
    const params = {
        TableName: emailTrackingDynamoDBTable,
        Item: {
            email: userEmail,
        },
    };
    const data = await dynamoDbClient.put(params).promise();
    console.log("Data:", data);
};
exports.handler = async(event, context, callback) => {
    console.log("Received event:", JSON.stringify(event, null, 4));
    const emailTrackingDynamoDBTable = process.env.EmailTrackingDynamoDBTable;
    const emailTrackingDynamoDBRegion = process.env.EmailTrackingDynamoDBRegion;
    // Set the region
    AWS.config.update({ region: emailTrackingDynamoDBRegion });
    const dynamoDbClient = new AWS.DynamoDB.DocumentClient({
        region: emailTrackingDynamoDBRegion,
    });
    const message = event.Records[0].Sns.Message;
    const parsedMessage = JSON.parse(message);
    const messageType = parsedMessage.message_type;
    const userToken = parsedMessage.userToken;
    const userEmail = parsedMessage.username;
    const firstname = parsedMessage.firstname;
    const lastname = parsedMessage.lastname;
    const emailAlreadySent = await checkIfEmailSentAlready(
        dynamoDbClient,
        emailTrackingDynamoDBTable,
        userEmail
    );
    if (!emailAlreadySent) {
        // Send email using AWS SES
        console.log("Email is not already sent to the user: " + userEmail + ". Trying to send");
        const ses = new AWS.SES();
        const params = {
            Destination: {
                ToAddresses: [userEmail],
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: `<p>Hello ${firstname} ${lastname},</p>
            <p>To verify your email address with prod.mikea1.me, Please click the following link: <a href="https://prod.mikea1.me/v1/verifyUserEmail?email=${userEmail}&userToken=${userToken}">Verify Email</a> or paste the following link in the browser: https://prod.mikea1.me/v1/verifyUserEmail?email=${userEmail}&userToken=${userToken}</p>`,
                    },
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: `Verify you user account for prod.mikea1.me`,
                },
            },
            Source: `userverification@prod.mikea1.me`,
        };
        const data = await ses.sendEmail(params).promise();
        console.log(data);
        console.log("Email sent successfully");
        await logEmailSentToDynamoDB(
            dynamoDbClient,
            emailTrackingDynamoDBTable,
            userEmail
        );
        console.log("Email logged to DynamoDB");
    } else {
        console.log(
            "Email already sent to user: " + userEmail + " No need to send again"
        );
    }
    callback(null, "success");
};
