# Database Setup

This project uses a PostgreSQL database, which can be run locally using Docker.

## Running the Database

1.  **Install Docker:** Make sure you have Docker and Docker Compose installed on your system.
2.  **Start the Database:** Navigate to the `app` directory in your terminal and run the following command:
    ```bash
    docker-compose up -d
    ```
    This will start the PostgreSQL database in the background.

3.  **Stopping the Database:**
    ```bash
    docker-compose down
    ```

## Database Connection

The database will be available at:
`postgresql://user:password@localhost:5432/mydb`

This URL is configured in the `.env` file for Prisma to use.
