pipeline {
    agent any

    environment {
        REMOTE_HOST = '192.168.100.228'
        REMOTE_USER = 'terence'
        DEPLOY_DIR  = '/home/projects'
        APP_PORT    = '3042'
    }

    triggers {
        GenericTrigger(
            token: '56ae3c8b6ece4ad67ae7a5e985459584'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Write env file') {
            steps {
                withCredentials([
                    string(credentialsId: 'PROJECTS_DATABASE_URL', variable: 'PROJECTS_DATABASE_URL'),
                    string(credentialsId: 'PROJECTS_JWT_SECRET', variable: 'PROJECTS_JWT_SECRET'),
                    string(credentialsId: 'PROJECTS_ADMIN_EMAIL', variable: 'PROJECTS_ADMIN_EMAIL'),
                    string(credentialsId: 'PROJECTS_ADMIN_PASSWORD_HASH', variable: 'PROJECTS_ADMIN_PASSWORD_HASH'),
                ]) {
                    sh '''
                        cat > projects.env <<EOF
DATABASE_URL=${PROJECTS_DATABASE_URL}
JWT_SECRET=${PROJECTS_JWT_SECRET}
ADMIN_EMAIL=${PROJECTS_ADMIN_EMAIL}
ADMIN_PASSWORD_HASH=${PROJECTS_ADMIN_PASSWORD_HASH}
EOF
                    '''
                    sshagent(credentials: ['PROXMOX_APPS_KEY']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${DEPLOY_DIR}"
                            scp projects.env ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/projects.env
                        """
                    }
                }
            }
        }

        stage('Transfer Code') {
            steps {
                sshagent(credentials: ['PROXMOX_APPS_KEY']) {
                    sh """
                        rsync -az --delete \
                            --exclude='.git' \
                            --exclude='node_modules' \
                            --exclude='.next' \
                            --exclude='.env*' \
                            --exclude='projects.env' \
                            --exclude='certificates' \
                            ./ ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
                    """
                }
            }
        }

        stage('Build & Deploy') {
            steps {
                sshagent(credentials: ['PROXMOX_APPS_KEY']) {
                    sh """
                        ssh ${REMOTE_USER}@${REMOTE_HOST} "
                            cd ${DEPLOY_DIR}
                            docker compose build
                            docker compose up -d
                        "
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ['PROXMOX_APPS_KEY']) {
                    sh """
                        ssh ${REMOTE_USER}@${REMOTE_HOST} 'bash -s' << 'REMOTE_SCRIPT'
                            attempt=0
                            until curl -sf http://localhost:${APP_PORT}/login > /dev/null 2>&1; do
                                attempt=\$((attempt+1))
                                if [ "\$attempt" -ge 18 ]; then
                                    echo 'Health check timed out after 90s'
                                    exit 1
                                fi
                                echo "Waiting for app... (\$attempt/18)"
                                sleep 5
                            done
                            echo 'App is healthy'
REMOTE_SCRIPT
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Deployed successfully to ${REMOTE_HOST}:${APP_PORT}"
        }
        failure {
            echo "Deploy failed -- check logs above"
        }
    }
}
