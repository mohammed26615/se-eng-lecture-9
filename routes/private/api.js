const { v4 } = require('uuid');
const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');
const { isEmpty } = require('lodash');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userId', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')

    .first();
  
  console.log('user =>', user)
  user.isStudent = user.roleId === roles.student;
  user.isAdmin = user.roleId === roles.admin;

  return user;
}
module.exports = function(app) {
  // Register HTTP endpoint to get all users
  app.get('/api/v1/users', async function(req, res) {
    const results = await db.select('*').from('users');
    return res.json(results)
  });
  app.get('/api/v1/courses/:courseId/drop', async function (req ,res){
    var courseId =req.params.courseId;
    const user = await getUser(req);
    const result = await  db.select('*')
    .from('se_project.enrollments')
    .where('userId', user.id)
    .where('courseId', courseId).del();
    return res.status(301).redirect('/courses');
  });

  app.get('/api/v1/courses/:courseId/delete', async function (req ,res){
    var courseId = req.params.courseId;
    const result = await  db.select('*')
    .from('se_project.courses')
    .where('id', courseId).del();
    return res.status(301).redirect('/courses');
  });

  app.post('/api/v1/adminAddUser', async function(req, res) {
    // Check if user already exists in the system
    const userExists = await db.select('*').from('se_project.users').where('email', req.body.email);
    if (!isEmpty(userExists)) {
      return res.status(400).send('user exists');
    }
    
    const newUser = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      facultyId: req.body.facultyId,
      roleId: req.body.roleId,
    };
    //console.log(req.body);
    console.log(newUser);
    try {
      const result = await db('se_project.users').insert(newUser).returning('*');
      let user = result[0];
      await AddRelatedCourses(user.id, Number(user.facultyId));
      return res.status(301).redirect('/users');
    } catch (e) {
      console.log(e.message);
      const faculties = await db.select('*').from('se_project.faculties');
      return res.render('add-user', { faculties, errorMessage: "error adding new user" });
    }
  });

const AddRelatedCourses = async(userId, facultyId) => {
    var relatedCourses = await db.select('id').from('se_project.courses')
    .where('facultyId', facultyId);
    for(let i = 0; i < relatedCourses.length; i++){
      const newEnrol = {
        userId: userId,
        courseId: relatedCourses[i].id,
        grade: 0,
        active: true
      };
      await db('se_project.enrollments').insert(newEnrol).returning('*');
    }
  };

  app.post('/api/v1/add-grade/:enrollment_id', async function (req ,res){
 var e_id = Number(req.params.enrollment_id);
    var grade = Number(req.body.grade);
    var grade_letter = GetGradeLetter(grade);
    await db('se_project.enrollments')
    .where({enrollment_id: e_id})
    .update({
      grade: grade,
      grade_letter: grade_letter
    });
    return res.status(301).redirect('/mangeGrades');
  });

  function GetGradeLetter(grade){
    if (grade <49.9) return "F";
        else if (grade < 54.9) return "D";
        else if (grade < 59.9) return "D+";
        else if (grade < 64.9) return "C-";
        else if (grade < 69.9) return "C";
        else if (grade < 73.9) return "C+";
        else if (grade < 77.9) return "B-";
        else if (grade < 81.9) return "B";
        else if (grade < 85.9) return "B+";
        else if (grade < 89.9) return "A-";
        else if (grade < 93.9) return "A";
        else if (grade < 100) return "A+";
  }
  
  app.post('/api/v1/faculties/transfer', async function(req, res) {
     
    try {
     const user= await getUser(req);
     const newrequest = {
       userId:user.userId,
     currentFacultyId : user.facultyId ,
      newFacultyId:req.body.newFacultyId,
      };
      const a = await db('se_project.Transfer_requests').insert(newrequest).returning('*');
      return res.status(200).json(a);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send('Could not submit request');
 }});

app.get('/api/v1/transfer/:request_id/accept', async function (req ,res){
  var requestId = req.params.request_id;
  const request = await  db.select('*')
  .from('se_project.Transfer_requests')
  .where('id', requestId).first();

  await db('se_project.users')
    .where({id: request.userId})
    .update({
      facultyId: Number(request.newFacultyId)
    });

  // delete the request
  await db.select('*')
  .from('se_project.Transfer_requests')
  .where('id', requestId).del();


  // add the new courses
  await AddRelatedCourses(request.userId, Number(request.newFacultyId));
  return res.status(301).redirect('/courses');
});

// const DeleteOldEnrol = async

app.get('/api/v1/transfer/:request_id/reject', async function (req ,res){
  var requestId = req.params.request_id;
  await db.select('*')
  .from('se_project.Transfer_requests')
  .where('id', requestId).del();
  return res.status(301).redirect('/managerequest');
});

};
